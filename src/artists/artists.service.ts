import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBArtist } from "./entity/artist.entity";
import { DataSource, FindOptionsWhere, Repository } from "typeorm";
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
		private readonly tasksService: TasksService,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly dataSource: DataSource,
	) {
		this.tasksService.registerSystemTask({
			id: "identify-all-artists",
			run: async (context) => {
				await this.identifyAllArtists((completed, total) => {
					context.update(completed / total);
				});
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
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 5;

		const pool: DBArtist[] = [];
		let activeThreads = 0;
		let isFinding = false;
		let chunksLoaded = 0;
		let allChunksLoaded = false;
		let completed = 0;

		const count = await this.count({});
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
					const identities = await this.identifyArtist(artist);
					this.logger.debug(
						`Identified ${identities.length} identities to Artist #${completed + 1}`,
					);
				} catch (e) {
					this.logger.debug(
						`Failed to identify to Artist #${completed + 1}:`,
						e,
					);
				}

				onProgress?.(++completed, count);
				activeThreads--;
				setImmediate(handle);
			};

			const increasePool = () => {
				if (isFinding || allChunksLoaded) {
					return;
				}

				isFinding = true;
				this.findMany({
					amount: CHUNK_SIZE,
					offset: CHUNK_SIZE * chunksLoaded++,
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

	public async identifyArtist(artist: DBArtist) {
		let allIdentities = (await this.findIdentities(artist)).map((identity) =>
			identity.toIdentity(),
		);

		const deleteConditions: FindOptionsWhere<DBArtistIdentity>[] = [];
		const newEntries: DBArtistIdentity[] = [];

		if (!this.orderedIdentifiers.length) {
			this.logger.warn(
				`Cannot identity Artist "${artist.uuid}" because no Artist Identifiers are registered`,
			);
			return [];
		}

		for (const { identifier, plugin } of this.orderedIdentifiers) {
			const helper = await this.getInformationHelper(artist, (id, pluginId) =>
				allIdentities.filter(
					(identity) =>
						identity.identifierId == id &&
						(!pluginId || identity.pluginId == pluginId),
				),
			);
			const newIdentities = await identifier.identify(
				helper,
				new Logger(`PLUGIN ${plugin.package.name}`),
			);
			allIdentities = allIdentities.filter(
				(identity) =>
					identity.identifierId != identifier.id ||
					identity.pluginId != plugin.package.name,
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

			deleteConditions.push({
				artistUuid: artist.uuid,
				pluginId: plugin.package.name,
				identifierId: identifier.id,
			});
		}

		await this.identitiesRepository.delete(deleteConditions);
		await this.identitiesRepository.insert(newEntries);
		return newEntries;
	}

	public async getExternalUrls(artist: DBArtist) {
		return this.externalUrlsService.getArtistUrls(
			await this.getInformationHelper(artist),
		);
	}
}
