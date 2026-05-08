import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBArtist } from "./entity/artist.entity";
import {
	DataSource,
	FindOptionsWhere,
	In,
	IsNull,
	Not,
	Repository,
} from "typeorm";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { DBTrack } from "src/tracks/entities/track.entity";
import {
	ArtistIdentifier,
	ArtistInformationHelper,
	Identity,
	TrackIdentifier,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedIdentifier } from "src/identifiers/interface/loaded-identifier";
import { orderIdentifiers } from "src/identifiers/identifiers.util";
import { ExistingDependency } from "src/identifiers/interface/existing-identifier-dependency.interface";
import { TasksService } from "src/tasks/tasks.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { ArtistIdentificationResult } from "./interface/artist-identification-result.interface";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { randomUUID } from "crypto";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";

@Injectable()
export class ArtistsService {
	private readonly logger = new Logger("Artists Service");

	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier<ArtistIdentifier>>
	>();
	private orderedIdentifiers: LoadedIdentifier<ArtistIdentifier>[] = [];
	private readonly trackIdentifiers: ExistingDependency[] = [];

	constructor(
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
		@InjectRepository(DBArtistIdentity)
		private readonly identitiesRepository: Repository<DBArtistIdentity>,
		@InjectRepository(DBTrackArtist)
		private readonly trackArtistsRepository: Repository<DBTrackArtist>,
		@InjectRepository(DBArtistAttribute)
		private readonly artistAttributesRepository: Repository<DBArtistAttribute>,
		private readonly tasksService: TasksService,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly dataSource: DataSource,
	) {
		this.tasksService.registerSystemTask({
			id: "identify-all-artists",
			resumable: true,
			run: async (context) => {
				await this.identifyAllArtists(
					context.getRunId(),
					(completed, total) => {
						context.update(completed / total);
					},
				);
			},
		});
	}

	async setJoinPhrase(
		trackUuid: string,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		await this.trackArtistsRepository.update(
			{
				trackUuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);
	}

	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing?: false,
	): Promise<string | null>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing: true,
	): Promise<string>;
	async resolveArtist(
		pluginId: string,
		identifierId: string,
		identityValue: string,
		createIfMissing: boolean = false,
	): Promise<string | null> {
		const existingIdentity = await this.identitiesRepository.findOne({
			where: { pluginId, identifierId, identity: identityValue },
			select: ["artistUuid"],
		});

		if (existingIdentity) {
			return existingIdentity.artistUuid;
		}

		if (!createIfMissing) {
			return null;
		}

		return await this.dataSource.transaction(async (manager) => {
			const newArtist = manager.create(DBArtist);
			const savedArtist = await manager.save(newArtist);

			const newIdentity = manager.create(DBArtistIdentity, {
				artistUuid: savedArtist.uuid,
				pluginId,
				identifierId,
				identity: identityValue,
				ordinal: 0,
			});
			await manager.save(newIdentity);

			return savedArtist.uuid;
		});
	}

	async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		await this.trackArtistsRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});
	}

	async setTrackLinks(
		track: DBTrack,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		await this.clearTrackLinks(track, pluginId, identifierId);
		await this.trackArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				trackUuid: track.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);
	}

	async findOne(
		uuid: string,
		options: {
			withAttributes?: boolean;
			withIdentities?: boolean;
			withTracks?: number;
			withTrackAttributes?: boolean;
			withTrackArtists?: boolean;
		} = {},
	) {
		const artist = await this.artistsRepository.findOne({
			where: {
				uuid,
			},
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
			},
		});

		if (artist && options.withTracks) {
			artist.tracks = await this.trackArtistsRepository.find({
				where: {
					artistUuid: artist.uuid,
				},
				relations: {
					track: {
						attributes: options.withTrackAttributes,
						artists: options.withTrackArtists && {
							artist: {
								attributes: true,
							},
						},
					},
				},
				take: options.withTracks,
			});
		}

		return artist;
	}

	findIdentities(artist: DBArtist) {
		return this.identitiesRepository.findBy({
			artistUuid: artist.uuid,
		});
	}

	findMany(options: {
		amount: number;
		offset?: number;
		withAttributes?: boolean;
		withIdentities?: boolean;
	}) {
		return this.artistsRepository.find({
			take: options.amount,
			skip: options.offset,
			relations: {
				attributes: options.withAttributes,
				identities: options.withIdentities,
			},
		});
	}

	count(where: FindOptionsWhere<DBArtist> | FindOptionsWhere<DBArtist>[]) {
		return this.artistsRepository.countBy(where);
	}

	public registerIdentifier(
		identifier: ArtistIdentifier,
		plugin: LoadedPlugin,
	) {
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

	private orderIdentifiers() {
		this.orderedIdentifiers = orderIdentifiers(
			Array.from(this.identifiers.values()).flatMap((map) =>
				Array.from(map.values()),
			),
			this.trackIdentifiers,
		);
	}

	public registerTrackIdentifier(
		identifier: TrackIdentifier,
		plugin: LoadedPlugin,
	) {
		this.trackIdentifiers.push({
			sourceId: identifier.id,
			pluginId: plugin.package.name,
		});
		this.orderIdentifiers();
	}

	public async getInformationHelper(
		artist: DBArtist,
		getIdentities?: (id: string, pluginId?: string | null) => Identity[] | null,
	): Promise<ArtistInformationHelper> {
		if (!getIdentities) {
			const identities = await this.findIdentities(artist);

			getIdentities = (id, pluginId) => {
				return identities
					.filter(
						(identity) =>
							identity.identifierId == id &&
							(!pluginId || pluginId == identity.pluginId),
					)
					.map((identity) => identity.toIdentity());
			};
		}

		return {
			getArtistUuid: () => artist.uuid,
			getIdentity: (id, pluginId, multiple) => {
				const matches = getIdentities(id, pluginId);

				if (!matches?.length) {
					return null;
				}

				if (multiple) {
					return matches;
				}
				return matches[0] as any;
			},
		};
	}

	public async identifyAllArtists(
		runId: string,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 1;

		let pool: DBArtist[] = [];
		let activeThreads = 0;
		let isFinding = false;
		let chunksLoaded = 0;
		let allChunksLoaded = false;
		let completed = 0;
		const failedUuids: string[] = [];

		const criteria: FindOptionsWhere<DBArtist>[] = [
			{
				lastIdentificationRunId: Not(runId),
				uuid: Not(In(failedUuids)),
			},
			{
				lastIdentificationRunId: IsNull(),
				uuid: Not(In(failedUuids)),
			},
		];

		const count = await this.count(criteria);
		if (!count) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			const handle = async () => {
				activeThreads++;
				const artist = pool.shift();
				if (!artist) {
					activeThreads--;
					increasePool();

					if (!activeThreads) {
						resolve();
					}
					return;
				}

				try {
					const { mergedArtists, identities } = await this.identifyArtist(
						artist,
						runId,
					);
					this.logger.debug(
						`Identified ${identities.length} identities to Artist #${completed + 1}`,
					);

					pool = pool.filter((artist) => !mergedArtists.includes(artist.uuid));
					completed += mergedArtists.length;
				} catch (e) {
					this.logger.debug(
						`Failed to identify to Artist #${completed + 1}:`,
						e,
					);
					failedUuids.push(artist.uuid);
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
				this.artistsRepository
					.find({
						where: criteria,
						take: CHUNK_SIZE,
					})
					.then((artists) => {
						if (artists.length) {
							pool.push(...artists);
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

	// public async identifyArtist(
	// 	artist: DBArtist,
	// 	identificationSession: string,
	// ): Promise<ArtistIdentificationResult> {
	// 	let allIdentities = (await this.findIdentities(artist)).map((identity) =>
	// 		identity.toIdentity(),
	// 	);

	// 	// const deleteConditions: FindOptionsWhere<DBArtistIdentity>[] = [];
	// 	const newEntries: DBArtistIdentity[] = [];

	// 	if (!this.orderedIdentifiers.length) {
	// 		this.logger.warn(
	// 			`Cannot identity Artist "${artist.uuid}" because no Artist Identifiers are registered`,
	// 		);
	// 		return {
	// 			identities: [],
	// 			mergedArtists: [artist.uuid],
	// 		};
	// 	}

	// 	for (const { identifier, plugin } of this.orderedIdentifiers) {
	// 		const helper = await this.getInformationHelper(artist, (id, pluginId) =>
	// 			allIdentities.filter(
	// 				(identity) =>
	// 					identity.identifierId == id &&
	// 					(!pluginId || identity.pluginId == pluginId),
	// 			),
	// 		);
	// 		const newIdentities = await identifier.identify(
	// 			helper,
	// 			new Logger(`PLUGIN ${plugin.package.name}`),
	// 		);
	// 		allIdentities = allIdentities.filter(
	// 			(identity) =>
	// 				identity.identifierId != identifier.id ||
	// 				identity.pluginId != plugin.package.name,
	// 		);
	// 		if (newIdentities?.length) {
	// 			allIdentities.push(
	// 				...newIdentities.map((value) => ({
	// 					pluginId: plugin.package.name,
	// 					identifierId: identifier.id,
	// 					value,
	// 				})),
	// 			);
	// 			newEntries.push(
	// 				...newIdentities.map((identity, ordinal) =>
	// 					this.identitiesRepository.create({
	// 						artistUuid: artist.uuid,
	// 						pluginId: plugin.package.name,
	// 						identifierId: identifier.id,
	// 						identity,
	// 						ordinal,
	// 					}),
	// 				),
	// 			);
	// 		}

	// 		// deleteConditions.push({
	// 		// 	artistUuid: artist.uuid,
	// 		// 	pluginId: plugin.package.name,
	// 		// 	identifierId: identifier.id,
	// 		// });
	// 	}

	// 	// console.log("Delete conditions:", deleteConditions);

	// 	// await this.identitiesRepository.delete(deleteConditions);

	// 	if (!newEntries.length) {
	// 		await this.artistsRepository.update(
	// 			{
	// 				uuid: artist.uuid,
	// 			},
	// 			{
	// 				lastIdentificationSession: identificationSession,
	// 			},
	// 		);
	// 		return {
	// 			identities: [],
	// 			mergedArtists: [artist.uuid],
	// 		};
	// 	}

	// 	const matchConditions: FindOptionsWhere<DBArtistIdentity>[] =
	// 		newEntries.map((newEntry) => ({
	// 			pluginId: newEntry.pluginId,
	// 			identifierId: newEntry.identifierId,
	// 			identity: newEntry.identity,
	// 		}));

	// 	const existingArtistIdentities = await this.identitiesRepository.find({
	// 		where: matchConditions,
	// 		relations: {
	// 			artist: true,
	// 		},
	// 	});

	// 	const existingArtistMap = new Map<string, DBArtist>();
	// 	for (const identity of existingArtistIdentities) {
	// 		if (identity.artist) {
	// 			existingArtistMap.set(identity.artist.uuid, identity.artist);
	// 		}
	// 	}

	// 	const existingArtists = Array.from(existingArtistMap.values());

	// 	return this.dataSource.transaction<ArtistIdentificationResult>(
	// 		async (tm) => {
	// 			const artistsRepo = tm.getRepository(DBArtist);
	// 			const identitiesRepo = tm.getRepository(DBArtistIdentity);
	// 			const trackArtistsRepo = tm.getRepository(DBTrackArtist);
	// 			const attributeSourcesRepo = tm.getRepository(DBArtistAttribute);

	// 			if (existingArtists.length > 1) {
	// 				this.logger.log(
	// 					`Found ${existingArtists.length} artists to combine!`,
	// 				);
	// 				existingArtists.sort((a, b) => a.dateAdded - b.dateAdded);
	// 				this.logger.log(existingArtists, existingArtistIdentities);

	// 				const masterArtist = existingArtists[0]!;
	// 				const allArtistIds = existingArtists.map((artist) => artist.uuid);
	// 				const removedArtistIds = allArtistIds.slice(1);

	// 				// combine identities
	// 				const allIdentities = await identitiesRepo.findBy({
	// 					artistUuid: In(allArtistIds),
	// 				});
	// 				const ordinalCount: Record<string, number> = {};
	// 				const masterIdentities: DBArtistIdentity[] = [];
	// 				const getOrdinal = (identity: DBArtistIdentity) => {
	// 					const id = `${identity.pluginId}:${identity.identifierId}`;
	// 					if (id in ordinalCount) {
	// 						ordinalCount[id]++;
	// 						return ordinalCount[id];
	// 					} else {
	// 						ordinalCount[id] = 1;
	// 						return 1;
	// 					}
	// 				};
	// 				for (const identity of newEntries) {
	// 					const migratedIdentity = identitiesRepo.create({
	// 						...identity,
	// 						artistUuid: masterArtist.uuid,
	// 					});
	// 					migratedIdentity.ordinal = getOrdinal(migratedIdentity);
	// 					masterIdentities.push(migratedIdentity);
	// 				}

	// 				for (const identity of allIdentities) {
	// 					// replaced by latest run of identifiers
	// 					if (
	// 						masterIdentities.some(
	// 							(i) =>
	// 								i.artistUuid == identity.artistUuid &&
	// 								i.pluginId == identity.pluginId &&
	// 								i.identifierId == identity.identifierId,
	// 						)
	// 					) {
	// 						continue;
	// 					}

	// 					// exact match to an existing identity
	// 					if (
	// 						masterIdentities.some(
	// 							(i) =>
	// 								i.pluginId == identity.pluginId &&
	// 								i.identifierId == identity.identifierId &&
	// 								i.identity == identity.identity,
	// 						)
	// 					) {
	// 						continue;
	// 					}

	// 					const migratedIdentity = identitiesRepo.create({
	// 						...identity,
	// 						artistUuid: masterArtist.uuid,
	// 					});

	// 					migratedIdentity.ordinal = getOrdinal(migratedIdentity);
	// 					masterIdentities.push(migratedIdentity);
	// 				}

	// 				await identitiesRepo.delete({
	// 					artistUuid: In(allArtistIds),
	// 				});
	// 				await identitiesRepo.insert(masterIdentities);

	// 				// combine track artists
	// 				const allTrackArtists = await trackArtistsRepo.findBy({
	// 					artistUuid: In(allArtistIds),
	// 				});

	// 				const newTrackArtists: Record<string, DBTrackArtist> = {};
	// 				for (const trackArtist of allTrackArtists) {
	// 					const id = `${trackArtist.pluginId}:${trackArtist.identifierId}:${trackArtist.trackUuid}`;

	// 					if (id in newTrackArtists) {
	// 						const existingTrackArtist = newTrackArtists[id];
	// 						if (existingTrackArtist.joinPhrase && !trackArtist.joinPhrase) {
	// 							continue;
	// 						}
	// 					}

	// 					newTrackArtists[id] = trackArtistsRepo.create({
	// 						...trackArtist,
	// 						artistUuid: masterArtist.uuid,
	// 					});
	// 				}

	// 				console.log("Master artist:", masterArtist);
	// 				console.log("Track Artists:", newTrackArtists);

	// 				await trackArtistsRepo.delete({
	// 					artistUuid: In(allArtistIds),
	// 				});
	// 				await trackArtistsRepo.insert(Object.values(newTrackArtists));

	// 				await attributeSourcesRepo.update(
	// 					{
	// 						entityId: In(removedArtistIds),
	// 					},
	// 					{
	// 						entityId: masterArtist.uuid,
	// 						entityRelationId: masterArtist.uuid,
	// 					},
	// 				);

	// 				await artistsRepo.delete({
	// 					uuid: In(removedArtistIds),
	// 				});
	// 				await artistsRepo.update(
	// 					{
	// 						uuid: masterArtist.uuid,
	// 					},
	// 					{
	// 						lastIdentificationSession: identificationSession,
	// 					},
	// 				);

	// 				for (const entry of newEntries) {
	// 					entry.artistUuid = masterArtist.uuid;
	// 				}

	// 				return {
	// 					mergedArtists: allArtistIds,
	// 					identities: masterIdentities,
	// 				};
	// 			} else {
	// 				await artistsRepo.update(
	// 					{
	// 						uuid: artist.uuid,
	// 					},
	// 					{
	// 						lastIdentificationSession: identificationSession,
	// 					},
	// 				);
	// 				await identitiesRepo.delete(
	// 					newEntries.map((entry) => ({
	// 						artistUuid: artist.uuid,
	// 						pluginId: entry.pluginId,
	// 						identifierId: entry.identifierId,
	// 					})),
	// 				);
	// 				await identitiesRepo.insert(newEntries);

	// 				return {
	// 					mergedArtists: [artist.uuid],
	// 					identities: newEntries,
	// 				};
	// 			}
	// 		},
	// 	);
	// }

	public async identifyArtist(
		artist: DBArtist,
		runId: string,
	): Promise<ArtistIdentificationResult> {
		let allIdentities = (await this.findIdentities(artist)).map((identity) =>
			identity.toIdentity(),
		);

		const newEntries: DBArtistIdentity[] = [];

		if (!this.orderedIdentifiers.length) {
			this.logger.warn(
				`Cannot identify Artist "${artist.uuid}" because no identifiers are registered`,
			);
			return { identities: [], mergedArtists: [artist.uuid] };
		}

		// 1. RUN IDENTIFIERS (Standard logic)
		for (const { identifier, plugin } of this.orderedIdentifiers) {
			const helper = await this.getInformationHelper(artist, (id, pluginId) =>
				allIdentities.filter(
					(i) => i.identifierId == id && (!pluginId || i.pluginId == pluginId),
				),
			);
			const newIdentities = await identifier.identify(
				helper,
				new Logger(`PLUGIN ${plugin.package.name}`),
			);

			allIdentities = allIdentities.filter(
				(i) =>
					i.identifierId != identifier.id || i.pluginId != plugin.package.name,
			);

			if (newIdentities?.length) {
				allIdentities.push(
					...newIdentities.map((value) => ({
						pluginId: plugin.package.name,
						identifierId: identifier.id,
						value,
					})),
				);
				newEntries.push(
					...newIdentities.map((identity, ordinal) =>
						this.identitiesRepository.create({
							artistUuid: artist.uuid,
							pluginId: plugin.package.name,
							identifierId: identifier.id,
							identity,
							ordinal,
						}),
					),
				);
			}
		}

		if (!newEntries.length) {
			await this.artistsRepository.update(
				{ uuid: artist.uuid },
				{ lastIdentificationRunId: runId },
			);
			return { identities: [], mergedArtists: [artist.uuid] };
		}

		// 2. FIND MERGE CANDIDATES
		const matchConditions = newEntries.map((e) => ({
			pluginId: e.pluginId,
			identifierId: e.identifierId,
			identity: e.identity,
		}));

		const existingArtistIdentities = await this.identitiesRepository.find({
			where: matchConditions,
			relations: { artist: true },
		});

		const existingArtistMap = new Map<string, DBArtist>();
		existingArtistMap.set(artist.uuid, artist); // Crucial: include self

		for (const identity of existingArtistIdentities) {
			if (identity.artist)
				existingArtistMap.set(identity.artist.uuid, identity.artist);
		}

		const existingArtists = Array.from(existingArtistMap.values());

		// 3. TRANSACTIONAL MERGE
		return this.dataSource.transaction<ArtistIdentificationResult>(
			async (tm) => {
				const artistsRepo = tm.getRepository(DBArtist);
				const idRepo = tm.getRepository(DBArtistIdentity);
				const trackArtistsRepo = tm.getRepository(DBTrackArtist);
				const attrRepo = tm.getRepository(DBArtistAttribute);

				if (existingArtists.length > 1) {
					existingArtists.sort((a, b) => a.dateAdded - b.dateAdded);
					const masterArtist = existingArtists[0]!;
					const allArtistIds = existingArtists.map((a) => a.uuid);
					const removedArtistIds = allArtistIds.slice(1);

					// --- A. MERGE IDENTITIES ---
					const currentIds = await idRepo.findBy({
						artistUuid: In(allArtistIds),
					});
					const masterIdentities: DBArtistIdentity[] = [];
					const idOrdinalMap: Record<string, number> = {};

					const addIdentity = (data: Partial<DBArtistIdentity>) => {
						const valKey = `${data.pluginId}:${data.identifierId}:${data.identity}`;
						if (
							masterIdentities.some(
								(i) =>
									`${i.pluginId}:${i.identifierId}:${i.identity}` === valKey,
							)
						)
							return;

						const ordKey = `${data.pluginId}:${data.identifierId}`;
						const ordinal = idOrdinalMap[ordKey] || 0;
						idOrdinalMap[ordKey] = ordinal + 1;

						masterIdentities.push(
							idRepo.create({
								...data,
								artistUuid: masterArtist.uuid,
								ordinal,
							}),
						);
					};

					newEntries.forEach(addIdentity);
					currentIds.forEach(addIdentity);

					await idRepo.delete({ artistUuid: In(allArtistIds) });
					await idRepo.insert(masterIdentities);

					// --- B. MERGE ATTRIBUTES (Prevent Identical-Value Duplicates) ---
					const allAttrs = await attrRepo.find({
						where: { entityId: In(allArtistIds) },
					});
					const masterAttributes: DBArtistAttribute[] = [];
					const attrOrdinalMap: Record<string, number> = {};

					for (const attr of allAttrs) {
						// Check if an attribute with the same plugin, source, key, and VALUE already exists
						const isDuplicateValue = masterAttributes.some(
							(ma) =>
								ma.pluginId === attr.pluginId &&
								ma.sourceId === attr.sourceId &&
								ma.key === attr.key &&
								((ma.value_boolean !== null &&
									ma.value_boolean === attr.value_boolean) ||
									(ma.value_decimal !== null &&
										ma.value_decimal === attr.value_decimal) ||
									(ma.value_int !== null && ma.value_int === attr.value_int) ||
									(ma.value_string !== null &&
										ma.value_string === attr.value_string) ||
									(ma.value_buffer !== null &&
										ma.value_buffer.uuid === attr.value_buffer?.uuid)),
						);

						if (isDuplicateValue) continue;

						// Re-calculate ordinal to avoid SQLITE_CONSTRAINT
						const ordKey = `${attr.pluginId}:${attr.sourceId}:${attr.key}`;
						const ordinal = attrOrdinalMap[ordKey] || 0;
						attrOrdinalMap[ordKey] = ordinal + 1;

						masterAttributes.push(
							attrRepo.create({
								...attr,
								entityId: masterArtist.uuid,
								entityRelationId: masterArtist.uuid,
								ordinal,
							}),
						);
					}

					await attrRepo.delete({ entityId: In(allArtistIds) });
					if (masterAttributes.length) await attrRepo.insert(masterAttributes);

					// --- C. MERGE TRACK LINKS (Preserve Cross-Plugin Links) ---
					const allLinks = await trackArtistsRepo.findBy({
						artistUuid: In(allArtistIds),
					});
					const uniqueLinks: Record<string, DBTrackArtist> = {};

					for (const link of allLinks) {
						// Key by track + plugin + identifier to allow multiple plugins per track
						const compositeKey = `${link.trackUuid}:${link.pluginId}:${link.identifierId}`;

						if (!uniqueLinks[compositeKey]) {
							uniqueLinks[compositeKey] = trackArtistsRepo.create({
								...link,
								artistUuid: masterArtist.uuid,
							});
						}
					}

					await trackArtistsRepo.delete({ artistUuid: In(allArtistIds) });
					await trackArtistsRepo.insert(Object.values(uniqueLinks));

					// --- D. CLEANUP ---
					await artistsRepo.delete({ uuid: In(removedArtistIds) });
					await artistsRepo.update(masterArtist.uuid, {
						lastIdentificationRunId: runId,
					});

					return { mergedArtists: allArtistIds, identities: masterIdentities };
				} else {
					// Standard single-artist update
					await artistsRepo.update(artist.uuid, {
						lastIdentificationRunId: runId,
					});
					await idRepo.delete(
						newEntries.map((e) => ({
							artistUuid: artist.uuid,
							pluginId: e.pluginId,
							identifierId: e.identifierId,
						})),
					);
					await idRepo.insert(newEntries);
					return { mergedArtists: [artist.uuid], identities: newEntries };
				}
			},
		);
	}

	public async getExternalUrls(artist: DBArtist) {
		return this.externalUrlsService.getArtistUrls(
			await this.getInformationHelper(artist),
		);
	}
}
