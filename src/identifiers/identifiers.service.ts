import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Identifier, IdentifierDependency } from "sdk/identifier";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBIdentity } from "./entities/identity.entity";
import { Repository } from "typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";
import { LoadedLibraryHandler } from "src/libraries/interface/loaded-library.interface";
import { IdentifierResponse } from "./response/identifier.response";
import { ArtistsService } from "src/artists/artists.service";

interface LoadedIdentifier {
	plugin: LoadedPlugin;
	identifier: Identifier;
}

@Injectable()
export class IdentifiersService {
	private readonly logger = new Logger("Identifiers Service");
	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier>
	>();
	private orderedIdentifiers: LoadedIdentifier[] = [];

	constructor(
		@InjectRepository(DBIdentity)
		private readonly identitiesRepository: Repository<DBIdentity>,
		private readonly artistsService: ArtistsService,
	) {}

	public register(identifier: Identifier, plugin: LoadedPlugin) {
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
		this.orderIdentifiers();
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
						this.artistsService.setTrackLinks(
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

	private orderIdentifiers() {
		const inputs = Array.from(this.identifiers.values()).flatMap((map) =>
			Array.from(map.values()),
		);

		// Helper to generate unique keys for the Map
		const getFullId = (pluginId: string, id: string) => `${pluginId}:${id}`;

		const idMap = new Map<string, LoadedIdentifier>();
		for (const item of inputs) {
			const key = getFullId(item.plugin.package.name, item.identifier.id);
			idMap.set(key, item);
		}

		// 1. Resolve Dependency Keys Helper
		// If pluginId is null, it refers to the same plugin as the owner
		const resolveDepKey = (
			ownerPluginId: string,
			dep: IdentifierDependency,
		) => {
			return getFullId(dep.pluginId ?? ownerPluginId, dep.sourceId);
		};

		// 2. Recursive Pruning of missing hard dependencies
		const validKeys = new Set<string>();
		const invalidKeys = new Set<string>();

		function checkValidity(
			key: string,
			visited: Set<string> = new Set(),
		): boolean {
			if (invalidKeys.has(key)) return false;
			if (validKeys.has(key)) return true;
			if (visited.has(key)) return true; // Potential cycle, handle in Kahn's

			const item = idMap.get(key);
			if (!item) return false;

			visited.add(key);
			const ownerPluginId = item.plugin.package.name;

			for (const dep of item.identifier.getDependencies()) {
				const depKey = resolveDepKey(ownerPluginId, dep);
				if (!checkValidity(depKey, visited)) {
					invalidKeys.add(key);
					return false;
				}
			}
			validKeys.add(key);
			return true;
		}

		const prunedKeys = Array.from(idMap.keys()).filter((key) =>
			checkValidity(key),
		);
		const prunedIdMap = new Map(prunedKeys.map((k) => [k, idMap.get(k)!]));

		// 3. Graph Building
		const adj = new Map<string, Set<string>>();
		const hardInDegree = new Map<string, number>();
		const softInDegree = new Map<string, number>();

		for (const key of prunedKeys) {
			adj.set(key, new Set());
			hardInDegree.set(key, 0);
			softInDegree.set(key, 0);
		}

		for (const [key, item] of prunedIdMap) {
			const pluginId = item.plugin.package.name;

			// Hard Dependencies
			for (const dep of item.identifier.getDependencies()) {
				const depKey = resolveDepKey(pluginId, dep);
				if (prunedIdMap.has(depKey)) {
					adj.get(depKey)!.add(key);
					hardInDegree.set(key, hardInDegree.get(key)! + 1);
				}
			}

			// Soft Dependencies
			for (const dep of item.identifier.getSoftDependencies()) {
				const depKey = resolveDepKey(pluginId, dep);
				if (prunedIdMap.has(depKey)) {
					adj.get(depKey)!.add(key);
					softInDegree.set(key, softInDegree.get(key)! + 1);
				}
			}
		}

		// 4. Topological Sort (Modified Kahn's)
		const result: LoadedIdentifier[] = [];
		const remainingKeys = new Set(prunedKeys);

		while (remainingKeys.size > 0) {
			// Priority 1: No dependencies at all (Hard or Soft)
			let ready = Array.from(remainingKeys).filter(
				(k) => hardInDegree.get(k) === 0 && softInDegree.get(k) === 0,
			);

			// Priority 2: Only hard dependencies are satisfied (Resolves soft cycles/missing soft)
			if (ready.length === 0) {
				const onlyHardReady = Array.from(remainingKeys).filter(
					(k) => hardInDegree.get(k) === 0,
				);

				if (onlyHardReady.length === 0) {
					// Pure Hard Cycle remaining - cannot resolve
					break;
				}
				// Pick one to break the soft-dependency lock
				ready = [onlyHardReady[0]];
			}

			for (const key of ready) {
				const item = prunedIdMap.get(key)!;
				result.push(item);
				remainingKeys.delete(key);

				for (const dependentKey of adj.get(key) || []) {
					const dependent = prunedIdMap.get(dependentKey)!;
					const depPluginId = dependent.plugin.package.name;

					// Determine if the link we just satisfied was hard or soft
					const isHard = dependent.identifier
						.getDependencies()
						.some((d) => resolveDepKey(depPluginId, d) === key);

					if (isHard) {
						hardInDegree.set(dependentKey, hardInDegree.get(dependentKey)! - 1);
					} else {
						softInDegree.set(dependentKey, softInDegree.get(dependentKey)! - 1);
					}
				}
			}
		}

		this.orderedIdentifiers = result;
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

	toResponse(identifier: LoadedIdentifier): IdentifierResponse {
		return {
			pluginId: identifier.plugin.package.name,
			identifierId: identifier.identifier.id,
			dependencies: identifier.identifier.getDependencies(),
			softDependencies: identifier.identifier.getSoftDependencies(),
		};
	}
}
