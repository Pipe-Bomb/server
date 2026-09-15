import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Identifier, TrackIdentifier } from "sdk/identifier";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DeregistrationBlockedError } from "src/util/deregistration-blocked.error";
import { DBIdentity } from "./entities/identity.entity";
import { Repository } from "typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { IdentifierResponse } from "./response/identifier.response";
import { LoadedIdentifier } from "./interface/loaded-identifier";
import { orderIdentifiers } from "./identifiers.util";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { Identity } from "@sdk";
import { IdentifierTarget } from "./enum/identifier-target.enum";
import { IdentifierType } from "./enum/identifier-type.enum";
import { DisabledIdentifiersService } from "./disabled-identifiers.service";

@Injectable()
export class IdentifiersService {
	private readonly logger = new Logger("Identifiers Service");
	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier<TrackIdentifier>>
	>();
	private orderedIdentifiers: LoadedIdentifier<TrackIdentifier>[] = [];

	constructor(
		@InjectRepository(DBIdentity)
		private readonly identitiesRepository: Repository<DBIdentity>,
		private readonly disabledIdentifiersService: DisabledIdentifiersService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly albumManagerService: AlbumManagerService,
	) {}

	public unregister(identifier: TrackIdentifier, plugin: LoadedPlugin) {
		const pluginIdentifiers = this.identifiers.get(plugin.package.name);
		if (!pluginIdentifiers?.has(identifier.id)) {
			return;
		}

		const targetKey = `${plugin.package.name}:${identifier.id}`;
		const allLoaded = Array.from(this.identifiers.values()).flatMap((m) =>
			Array.from(m.values()),
		);

		const blockedBy = allLoaded
			.filter(
				(loaded) =>
					!(
						loaded.plugin.package.name === plugin.package.name &&
						loaded.identifier.id === identifier.id
					),
			)
			.filter((loaded) =>
				loaded.identifier.getDependencies().some((dep) => {
					if (dep.pluginId !== null) {
						return `${dep.pluginId}:${dep.sourceId}` === targetKey;
					}
					return dep.sourceId === identifier.id;
				}),
			)
			.map(
				(loaded) =>
					`TrackIdentifier:${loaded.plugin.package.name}:${loaded.identifier.id}`,
			);

		if (blockedBy.length) {
			throw new DeregistrationBlockedError(
				`TrackIdentifier:${targetKey}`,
				blockedBy,
			);
		}

		pluginIdentifiers.delete(identifier.id);
		if (pluginIdentifiers.size === 0) {
			this.identifiers.delete(plugin.package.name);
		}
		this.orderedIdentifiers = orderIdentifiers(
			Array.from(this.identifiers.values()).flatMap((m) =>
				Array.from(m.values()),
			),
		);

		if (identifier.target === "artist") {
			this.artistManagerService.unregisterTrackIdentifier(identifier, plugin);
		}
		if (identifier.target === "album") {
			this.albumManagerService.unregisterTrackIdentifier(identifier, plugin);
		}

		this.logger.log(
			`Plugin "${plugin.package.name}" unregistered Identifier "${identifier.id}"`,
		);
	}

	public register(identifier: TrackIdentifier, plugin: LoadedPlugin) {
		const pluginIdentifiers = this.identifiers.get(plugin.package.name);
		if (pluginIdentifiers) {
			if (pluginIdentifiers.has(identifier.id)) {
				throw new Error(
					`Plugin has already registered Identifier with ID "${identifier.id}"`,
				);
			}
			pluginIdentifiers.set(identifier.id, { identifier, plugin });
		} else {
			this.identifiers.set(
				plugin.package.name,
				new Map([[identifier.id, { identifier, plugin }]]),
			);
		}
		this.orderedIdentifiers = orderIdentifiers(
			Array.from(this.identifiers.values()).flatMap((map) =>
				Array.from(map.values()),
			),
		);

		if (identifier.target == "artist") {
			this.artistManagerService.registerTrackIdentifier(identifier, plugin);
		}
		if (identifier.target == "album") {
			this.albumManagerService.registerTrackIdentifier(identifier, plugin);
		}

		this.logger.log(
			`Plugin "${plugin.package.name}" registered Identifier "${identifier.id}"`,
		);
	}

	public async identifyTrackWithIdentity(track: DBTrack, identity: Identity) {
		const identifier = this.identifiers
			.get(identity.pluginId)
			?.get(identity.identityId);
		if (!identifier) {
			throw new Error("Identifier does not exist");
		}

		await this.identitiesRepository.upsert(
			{
				pluginId: identity.pluginId,
				identifierId: identity.identityId,
				identity: identity.identity,
				trackUuid: track.uuid,
				ordinal: 0,
			},
			{
				conflictPaths: ["pluginId", "identifierId", "trackUuid", "ordinal"],
			},
		);
	}

	public getDisabledSet(): Promise<Set<string>> {
		return this.disabledIdentifiersService.getDisabledSet();
	}

	public async identifyTrack(
		track: DBTrack,
		library: LoadedLibraryHandler,
		disabledSet: Set<string> = new Set(),
	) {
		const identifiers = this.all();

		this.logger.debug(
			`Identifying Track "${track.trackId}" using ${identifiers.length} Identifiers...`,
		);

		const effectivelyDisabled = new Set<string>();

		for (const { identifier, plugin } of identifiers) {
			try {
				const key3 = `${plugin.package.name}:${identifier.id}:track`;
				const key2 = `${plugin.package.name}:${identifier.id}`;

				const disabled =
					disabledSet.has(key3) ||
					identifier.getDependencies().some((dep) => {
						const resolvedPluginId = dep.pluginId ?? plugin.package.name;
						return effectivelyDisabled.has(
							`${resolvedPluginId}:${dep.sourceId}`,
						);
					});

				if (disabled) {
					effectivelyDisabled.add(key2);
				}

				const identities = disabled
					? null
					: await identifier.identify(
							await library.informationHelper(track),
							new Logger(`PLUGIN ${plugin.package.name}`),
						);

				if (identities?.length) {
					// todo: i probably only need to upsert identities with "track" target
					await this.identitiesRepository.upsert(
						identities.map((identity, index) => ({
							identifierId: identifier.id,
							pluginId: plugin.package.name,
							trackUuid: track.uuid,
							identity,
							ordinal: index,
						})),
						{
							conflictPaths: [
								"pluginId",
								"identifierId",
								"trackUuid",
								"ordinal",
							],
						},
					);

					if (identifier.target == "artist") {
						const artistUuids: string[] = [];
						for (const value of identities) {
							const artistUuid = await this.artistManagerService.resolveArtist(
								plugin.package.name,
								identifier.id,
								value,
								ArtistIdentityTarget.TRACK,
								true,
							);
							artistUuids.push(artistUuid);
						}
						await this.artistManagerService.setTrackLinks(
							track,
							artistUuids,
							plugin.package.name,
							identifier.id,
						);
					}

					if (identifier.target == "album") {
						const albumUuids: string[] = [];
						for (const value of identities) {
							const albumUuid = await this.albumManagerService.resolveAlbum(
								plugin.package.name,
								identifier.id,
								value,
								true,
							);
							albumUuids.push(albumUuid);
						}
						await this.albumManagerService.setTrackLinks(
							track,
							albumUuids,
							plugin.package.name,
							identifier.id,
						);
					}
				} else {
					await this.artistManagerService.clearTrackLinks(
						track,
						plugin.package.name,
						identifier.id,
					);
					await this.albumManagerService.clearTrackLinks(
						track,
						plugin.package.name,
						identifier.id,
					);
					await this.identitiesRepository.delete({
						identifierId: identifier.id,
						pluginId: plugin.package.name,
						trackUuid: track.uuid,
					});
				}
			} catch (e) {
				this.logger.error(
					`An error occured while trying to identify Track "${track.trackId}" (Library: "${library.handler.id}", Plugin: "${plugin.package.name}") with Identifier "${identifier.id}":`,
					e,
				);
			}
		}
	}

	all() {
		return [...this.orderedIdentifiers];
	}

	public getTrackIdentities(track: DBTrack) {
		return this.identitiesRepository.findBy({
			trackUuid: track.uuid,
		});
	}

	public getTrackIdentity(
		track: DBTrack,
		identifierId: string,
		pluginId: string | null,
	) {
		return this.identitiesRepository.findBy({
			trackUuid: track.uuid,
			identifierId,
			pluginId: pluginId ?? undefined,
		});
	}

	async clean() {
		const identifiers: { pluginId: string; identityId: string }[] = [];
		for (const [pluginId, entry] of this.identifiers) {
			for (const identityId of entry.keys()) {
				identifiers.push({ pluginId, identityId });
			}
		}

		if (!identifiers.length) {
			await this.identitiesRepository.deleteAll();
			return;
		}

		const conditionStrings: string[] = [];
		const queryParameters: Record<string, string> = {};

		for (const [index, { pluginId, identityId }] of identifiers.entries()) {
			const pluginKey = `p_${index}`;
			const identifierKey = `i_${index}`;

			conditionStrings.push(
				`(pluginId = :${pluginKey} AND identifierId = :${identifierKey})`,
			);

			queryParameters[pluginKey] = pluginId;
			queryParameters[identifierKey] = identityId;
		}

		await this.identitiesRepository
			.createQueryBuilder()
			.delete()
			.from(DBIdentity)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();
	}

	allArtist() {
		return this.artistManagerService.getIdentifiers();
	}

	allAlbum() {
		return this.albumManagerService.getIdentifiers();
	}

	toResponse(
		identifier: LoadedIdentifier<Identifier>,
		type: IdentifierType,
		disabled: boolean,
	): IdentifierResponse {
		const target = (identifier.identifier as { target?: string }).target;
		return {
			pluginId: identifier.plugin.package.name,
			identifierId: identifier.identifier.id,
			type,
			target: (target as IdentifierTarget) ?? null,
			dependencies: identifier.identifier.getDependencies(),
			softDependencies: identifier.identifier.getSoftDependencies(),
			disabled,
		};
	}
}
