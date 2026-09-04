import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import {
	DataSource,
	FindOptionsWhere,
	In,
	IsNull,
	Not,
	Repository,
} from "typeorm";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
import { DBAlbumMerge } from "./entity/album-merge.entity";
import { DBAlbumTrack } from "./entity/album-track.entity";
import { DBAlbumArtist } from "./entity/album-artist.entity";
import { AlbumIdentificationResult } from "./interface/album-identification-result.interface";
import { TasksService } from "src/tasks/tasks.service";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";

@Injectable()
export class AlbumsService {
	private readonly logger = new Logger("Albums Service");

	constructor(
		@InjectRepository(DBAlbum)
		private readonly albumsRepository: Repository<DBAlbum>,
		@InjectRepository(DBAlbumIdentity)
		private readonly identitiesRepository: Repository<DBAlbumIdentity>,
		private readonly albumManagerService: AlbumManagerService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly tasksService: TasksService,
		private readonly dataSource: DataSource,
	) {
		this.tasksService.registerSystemTask<"all" | "new">({
			id: "identify-albums",
			resumable: true,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				await this.identifyAllAlbums(
					context.getRunId(),
					subTaskId == "new",
					(completed, total) => {
						context.update(completed / total);
					},
				);
			},
		});
	}

	public async identifyAlbum(
		album: DBAlbum,
		runId: string,
	): Promise<AlbumIdentificationResult> {
		const identifiers = this.albumManagerService.getIdentifiers();

		if (!identifiers.length) {
			this.logger.warn(
				`Cannot identify Album "${album.uuid}" because no identifiers are registered`,
			);
			await this.albumManagerService.setRunId(album, runId, "identity");
			return { identities: [], mergedAlbums: [album.uuid], splitCount: 0 };
		}

		this.logger.debug(
			`Identifying Album "${album.uuid}" using ${identifiers.length} Identifiers...`,
		);

		// Build newEntries in-memory first; artist links can be set immediately
		let allIdentities = await this.albumManagerService.findIdentities(album);
		const newEntries: DBAlbumIdentity[] = [];

		for (const { identifier, plugin } of identifiers) {
			const informationHelper =
				await this.albumManagerService.getInformationHelper(
					album,
					(id, pluginId) =>
						allIdentities
							.filter(
								(i) =>
									i.identifierId === id &&
									(!pluginId || i.pluginId === pluginId),
							)
							.map((i) => i.toIdentity()),
				);

			let identities: string[] | null | undefined;
			try {
				identities = await identifier.identify(
					informationHelper,
					new Logger(`PLUGIN ${plugin.package.name}`),
				);
			} catch (e) {
				this.logger.error(
					`An error occured while trying to identify Album "${album.uuid}" with Identifier "${identifier.id}":`,
					e,
				);
				continue;
			}

			// Remove stale entries for this identifier from in-memory state
			allIdentities = allIdentities.filter(
				(i) =>
					i.identifierId !== identifier.id ||
					i.pluginId !== plugin.package.name,
			);

			if (identities?.length) {
				if (identifier.target === "artist") {
					const artistUuids: string[] = [];
					for (const value of identities) {
						const artistUuid = await this.artistManagerService.resolveArtist(
							plugin.package.name,
							identifier.id,
							value,
							ArtistIdentityTarget.ALBUM,
							true,
						);
						artistUuids.push(artistUuid);
					}
					await this.albumManagerService.setArtistLinks(
						album,
						artistUuids,
						plugin.package.name,
						identifier.id,
					);
				}

				for (const [ordinal, identity] of identities.entries()) {
					const entry = this.identitiesRepository.create({
						identifierId: identifier.id,
						pluginId: plugin.package.name,
						albumUuid: album.uuid,
						identity,
						ordinal,
						originalAlbumUuid: album.uuid,
					});
					allIdentities.push(entry);
					newEntries.push(entry);
				}
			} else {
				await this.albumManagerService.clearArtistLinks(
					album,
					plugin.package.name,
					identifier.id,
				);
				await this.identitiesRepository.delete({
					identifierId: identifier.id,
					pluginId: plugin.package.name,
					albumUuid: album.uuid,
				});
			}
		}

		if (!newEntries.length) {
			await this.albumManagerService.setRunId(album, runId, "identity");
			return { identities: [], mergedAlbums: [album.uuid], splitCount: 0 };
		}

		// Find merge candidates
		const matchConditions = newEntries.map((e) => ({
			pluginId: e.pluginId,
			identifierId: e.identifierId,
			identity: e.identity,
		}));

		const existingAlbumIdentities = await this.identitiesRepository.find({
			where: matchConditions,
			relations: { album: true },
		});

		const existingAlbumMap = new Map<string, DBAlbum>();
		existingAlbumMap.set(album.uuid, album);
		for (const identity of existingAlbumIdentities) {
			if (identity.album) {
				existingAlbumMap.set(identity.album.uuid, identity.album);
			}
		}

		const existingAlbums = Array.from(existingAlbumMap.values());

		const txResult = await this.dataSource.transaction<{
			mergedAlbums: string[];
			identities: DBAlbumIdentity[];
			survivingAlbum: DBAlbum;
		}>(async (tm) => {
			const albumsRepo = tm.getRepository(DBAlbum);
			const idRepo = tm.getRepository(DBAlbumIdentity);
			const albumTracksRepo = tm.getRepository(DBAlbumTrack);
			const albumArtistsRepo = tm.getRepository(DBAlbumArtist);
			const mergesRepo = tm.getRepository(DBAlbumMerge);

			if (existingAlbums.length > 1) {
				existingAlbums.sort((a, b) => a.dateAdded - b.dateAdded);
				const masterAlbum = existingAlbums[0];
				const allAlbumIds = existingAlbums.map((a) => a.uuid);
				const removedAlbumIds = allAlbumIds.slice(1);

				// Merge identities
				const currentIds = await idRepo.findBy({
					albumUuid: In(allAlbumIds),
				});
				const masterIdentities: DBAlbumIdentity[] = [];
				const idOrdinalMap: Record<string, number> = {};

				const addIdentity = (data: Partial<DBAlbumIdentity>) => {
					const valKey = `${data.pluginId}:${data.identifierId}:${data.identity}`;
					if (
						masterIdentities.some(
							(i) => `${i.pluginId}:${i.identifierId}:${i.identity}` === valKey,
						)
					) {
						return;
					}
					const ordKey = `${data.pluginId}:${data.identifierId}`;
					const ordinal = idOrdinalMap[ordKey] || 0;
					idOrdinalMap[ordKey] = ordinal + 1;
					masterIdentities.push(
						idRepo.create({
							...data,
							albumUuid: masterAlbum.uuid,
							ordinal,
						}),
					);
				};

				newEntries.forEach(addIdentity);
				currentIds.forEach(addIdentity);

				await idRepo.delete({ albumUuid: In(allAlbumIds) });
				if (masterIdentities.length) {
					await idRepo.insert(masterIdentities);
				}

				// Merge track links
				const allTrackLinks = await albumTracksRepo.findBy({
					albumUuid: In(allAlbumIds),
				});
				const uniqueTrackLinks: Record<string, DBAlbumTrack> = {};
				for (const link of allTrackLinks) {
					const key = `${link.trackUuid}:${link.pluginId}:${link.identifierId}`;
					if (!uniqueTrackLinks[key]) {
						uniqueTrackLinks[key] = albumTracksRepo.create({
							...link,
							albumUuid: masterAlbum.uuid,
						});
					}
				}
				await albumTracksRepo.delete({ albumUuid: In(allAlbumIds) });
				if (Object.keys(uniqueTrackLinks).length) {
					await albumTracksRepo.insert(Object.values(uniqueTrackLinks));
				}

				// Merge artist links
				const allArtistLinks = await albumArtistsRepo.findBy({
					albumUuid: In(allAlbumIds),
				});
				const uniqueArtistLinks: Record<string, DBAlbumArtist> = {};
				for (const link of allArtistLinks) {
					const key = `${link.artistUuid}:${link.pluginId}:${link.identifierId}`;
					if (!uniqueArtistLinks[key]) {
						uniqueArtistLinks[key] = albumArtistsRepo.create({
							...link,
							albumUuid: masterAlbum.uuid,
						});
					}
				}
				await albumArtistsRepo.delete({ albumUuid: In(allAlbumIds) });
				if (Object.keys(uniqueArtistLinks).length) {
					await albumArtistsRepo.insert(Object.values(uniqueArtistLinks));
				}

				await albumsRepo.delete({ uuid: In(removedAlbumIds) });
				await albumsRepo.update(masterAlbum.uuid, {
					lastIdentificationRunId: runId,
				});

				await mergesRepo.insert(
					removedAlbumIds.map((mergedUuid) => ({
						mergedUuid,
						masterUuid: masterAlbum.uuid,
						mergedAt: Date.now(),
					})),
				);

				return {
					mergedAlbums: allAlbumIds,
					identities: masterIdentities,
					survivingAlbum: masterAlbum,
				};
			}

			// Single album — no merge
			await albumsRepo.update(album.uuid, {
				lastIdentificationRunId: runId,
			});
			await idRepo.delete(
				newEntries.map((e) => ({
					albumUuid: album.uuid,
					pluginId: e.pluginId,
					identifierId: e.identifierId,
				})),
			);
			await idRepo.insert(newEntries);
			return {
				mergedAlbums: [album.uuid],
				identities: newEntries,
				survivingAlbum: album,
			};
		});

		const currentIds = await this.identitiesRepository.findBy({
			albumUuid: txResult.survivingAlbum.uuid,
		});
		const splitCount = await this.evaluateAlbumSplit(
			txResult.survivingAlbum,
			currentIds,
		);
		return {
			mergedAlbums: txResult.mergedAlbums,
			identities: txResult.identities,
			splitCount,
		};
	}

	private async evaluateAlbumSplit(
		album: DBAlbum,
		allIds: DBAlbumIdentity[],
	): Promise<number> {
		const hasMergedOrigins = allIds.some(
			(i) => i.originalAlbumUuid !== null && i.originalAlbumUuid !== album.uuid,
		);
		if (!hasMergedOrigins) {
			return 0;
		}

		const partitions = new Map<string, DBAlbumIdentity[]>();
		for (const id of allIds) {
			const key = id.originalAlbumUuid ?? album.uuid;
			if (!partitions.has(key)) {
				partitions.set(key, []);
			}
			partitions.get(key)!.push(id);
		}

		if (partitions.size <= 1) {
			return 0;
		}

		const identifiers = this.albumManagerService.getIdentifiers();
		const partitionOutputs = new Map<string, Set<string>>();

		for (const [originalUuid, partitionIds] of partitions) {
			const outputSet = new Set<string>();
			let runningIds = [...partitionIds];

			const helper = await this.albumManagerService.getInformationHelper(
				album,
				(id, pluginId) =>
					runningIds
						.filter(
							(i) =>
								i.identifierId === id && (!pluginId || i.pluginId === pluginId),
						)
						.map((i) => i.toIdentity()),
			);

			for (const { identifier, plugin } of identifiers) {
				runningIds = runningIds.filter(
					(i) =>
						i.identifierId !== identifier.id ||
						i.pluginId !== plugin.package.name,
				);

				let newIdentities: string[] | null | undefined;
				try {
					newIdentities = await identifier.identify(
						helper,
						new Logger(`SPLIT-EVAL ${plugin.package.name}`),
					);
				} catch {
					continue;
				}

				if (newIdentities?.length) {
					for (const [ordinal, identity] of newIdentities.entries()) {
						outputSet.add(
							`${plugin.package.name}:${identifier.id}:${identity}`,
						);
						runningIds.push(
							this.identitiesRepository.create({
								albumUuid: album.uuid,
								pluginId: plugin.package.name,
								identifierId: identifier.id,
								identity,
								ordinal,
								originalAlbumUuid: originalUuid,
							}),
						);
					}
				}
			}

			partitionOutputs.set(originalUuid, outputSet);
		}

		const partitionKeys = Array.from(partitions.keys());
		const parent = new Map<string, string>(partitionKeys.map((k) => [k, k]));

		const find = (x: string): string => {
			if (parent.get(x) !== x) {
				parent.set(x, find(parent.get(x)!));
			}
			return parent.get(x)!;
		};
		const union = (a: string, b: string) => {
			parent.set(find(a), find(b));
		};

		for (let i = 0; i < partitionKeys.length; i++) {
			for (let j = i + 1; j < partitionKeys.length; j++) {
				const aSet = partitionOutputs.get(partitionKeys[i])!;
				const bSet = partitionOutputs.get(partitionKeys[j])!;
				if ([...aSet].some((v) => bSet.has(v))) {
					union(partitionKeys[i], partitionKeys[j]);
				}
			}
		}

		const groups = new Map<string, string[]>();
		for (const key of partitionKeys) {
			const root = find(key);
			if (!groups.has(root)) {
				groups.set(root, []);
			}
			groups.get(root)!.push(key);
		}

		const masterRoot = find(album.uuid);
		const splitGroups = Array.from(groups.entries()).filter(
			([root]) => root !== masterRoot,
		);

		if (!splitGroups.length) {
			return 0;
		}

		let splitCount = 0;

		for (const [, groupOriginalUuids] of splitGroups) {
			await this.dataSource.transaction(async (tm) => {
				const albumsRepo = tm.getRepository(DBAlbum);
				const idRepo = tm.getRepository(DBAlbumIdentity);
				const albumTracksRepo = tm.getRepository(DBAlbumTrack);
				const albumArtistsRepo = tm.getRepository(DBAlbumArtist);
				const mergesRepo = tm.getRepository(DBAlbumMerge);

				const idsToMove = allIds.filter((i) =>
					groupOriginalUuids.includes(i.originalAlbumUuid ?? album.uuid),
				);
				const splitPluginKeys = new Set(
					idsToMove.map((i) => `${i.pluginId}:${i.identifierId}`),
				);

				const allTrackLinks = await albumTracksRepo.findBy({
					albumUuid: album.uuid,
				});
				const linksToMove = allTrackLinks.filter((l) =>
					splitPluginKeys.has(`${l.pluginId}:${l.identifierId}`),
				);

				const allArtistLinks = await albumArtistsRepo.findBy({
					albumUuid: album.uuid,
				});
				const artistLinksToMove = allArtistLinks.filter((l) =>
					splitPluginKeys.has(`${l.pluginId}:${l.identifierId}`),
				);

				const newAlbum = albumsRepo.create({
					title: "Unknown Album",
					lastIdentificationRunId: null,
				});
				const savedAlbum = await albumsRepo.save(newAlbum);

				if (idsToMove.length) {
					await idRepo.delete(
						idsToMove.map((i) => ({
							pluginId: i.pluginId,
							identifierId: i.identifierId,
							albumUuid: album.uuid,
							ordinal: i.ordinal,
						})),
					);
					await idRepo.insert(
						idsToMove.map((i) => ({ ...i, albumUuid: savedAlbum.uuid })),
					);
				}

				if (linksToMove.length) {
					await albumTracksRepo.delete(
						linksToMove.map((l) => ({
							albumUuid: album.uuid,
							trackUuid: l.trackUuid,
							pluginId: l.pluginId,
							identifierId: l.identifierId,
						})),
					);
					await albumTracksRepo.insert(
						linksToMove.map((l) => ({ ...l, albumUuid: savedAlbum.uuid })),
					);
				}

				if (artistLinksToMove.length) {
					await albumArtistsRepo.delete(
						artistLinksToMove.map((l) => ({
							albumUuid: album.uuid,
							artistUuid: l.artistUuid,
							pluginId: l.pluginId,
							identifierId: l.identifierId,
							ordinal: l.ordinal,
						})),
					);
					await albumArtistsRepo.insert(
						artistLinksToMove.map((l) => ({
							...l,
							albumUuid: savedAlbum.uuid,
						})),
					);
				}

				await mergesRepo.delete({
					mergedUuid: In(groupOriginalUuids),
					masterUuid: album.uuid,
				});
			});

			splitCount++;
		}

		return splitCount;
	}

	public async identifyAllAlbums(
		runId: string,
		onlyNew: boolean,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 1;

		let pool: DBAlbum[] = [];
		let activeThreads = 0;
		let isFinding = false;
		let chunksLoaded = 0;
		let allChunksLoaded = false;
		let completed = 0;
		const failedUuids: string[] = [];

		const getCriteria = (): FindOptionsWhere<DBAlbum>[] => {
			const criteria: FindOptionsWhere<DBAlbum>[] = [
				{
					lastIdentificationRunId: IsNull(),
					uuid: Not(In(failedUuids)),
				},
			];

			if (!onlyNew) {
				criteria.push({
					lastIdentificationRunId: Not(runId),
					uuid: Not(In(failedUuids)),
				});
			}
			return criteria;
		};

		let count = await this.albumManagerService.count(getCriteria());
		if (!count) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			const handle = async () => {
				activeThreads++;
				const album = pool.shift();
				if (!album) {
					activeThreads--;
					increasePool();

					if (!activeThreads && allChunksLoaded) {
						resolve();
					}
					return;
				}

				try {
					const { identities, mergedAlbums, splitCount } =
						await this.identifyAlbum(album, runId);
					this.logger.debug(
						`Identified ${identities.length} identities to Album #${completed + 1}`,
					);

					pool = pool.filter((album) => !mergedAlbums.includes(album.uuid));
					completed += mergedAlbums.length;

					if (splitCount > 0) {
						count += splitCount;
						allChunksLoaded = false;
						setImmediate(increasePool);
					}
				} catch (e) {
					this.logger.debug(
						`Failed to identify to Album #${completed + 1}:`,
						e,
					);
					failedUuids.push(album.uuid);
					completed++;
				}

				onProgress?.(completed, count);
				activeThreads--;
				setImmediate(handle);
			};

			const increasePool = () => {
				if (isFinding || allChunksLoaded) {
					return;
				}

				isFinding = true;
				this.albumsRepository
					.find({
						where: getCriteria(),
						take: CHUNK_SIZE,
					})
					.then((albums) => {
						if (albums.length) {
							pool.push(...albums);
							isFinding = false;
							if (chunksLoaded == 1) {
								onProgress?.(0, count);
							}
							for (let i = activeThreads; i < MAX_THREADS; i++) {
								handle();
							}
						} else {
							allChunksLoaded = true;
							if (!activeThreads) {
								resolve();
							}
						}
					})
					.catch(reject);
			};

			increasePool();
		});
	}
}
