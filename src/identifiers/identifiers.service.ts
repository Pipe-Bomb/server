import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TrackIdentifier, IdentifierDependency } from "sdk/identifier";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBIdentity } from "./entities/identity.entity";
import { Repository } from "typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { IdentifierResponse } from "./response/identifier.response";
import { ArtistsService } from "src/artists/artists.service";
import { LoadedIdentifier } from "./interface/loaded-identifier";
import { orderIdentifiers } from "./identifiers.util";
import { TrackManagerService } from "src/track-manager/track-manager.service";

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
		private readonly artistsService: ArtistsService,
	) {}

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
			this.artistsService.registerTrackIdentifier(identifier, plugin);
		}

		this.logger.log(
			`Plugin "${plugin.package.name}" registered Identifier "${identifier.id}"`,
		);
	}

	public async identifyTrack(track: DBTrack, library: LoadedLibraryHandler) {
		const identifiers = this.all();

		this.logger.debug(
			`Identifying Track "${track.trackId}" using ${identifiers.length} Identifiers...`,
		);

		for (const { identifier, plugin } of identifiers) {
			try {
				const identities = await identifier.identify(
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
							const artistUuid = await this.artistsService.resolveArtist(
								plugin.package.name,
								identifier.id,
								value,
								true,
							);
							artistUuids.push(artistUuid);
						}
						await this.artistsService.setTrackLinks(
							track,
							artistUuids,
							plugin.package.name,
							identifier.id,
						);
					}
				} else {
					await this.artistsService.clearTrackLinks(
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

	toResponse(
		identifier: LoadedIdentifier<TrackIdentifier>,
	): IdentifierResponse {
		return {
			pluginId: identifier.plugin.package.name,
			identifierId: identifier.identifier.id,
			dependencies: identifier.identifier.getDependencies(),
			softDependencies: identifier.identifier.getSoftDependencies(),
		};
	}
}
