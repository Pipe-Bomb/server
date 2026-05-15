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
import { DBAlbumArtist } from "./entity/album-artist.entity";
import { DBAlbumTrack } from "./entity/album-track.entity";
import { LoadedIdentifier } from "src/identifiers/interface/loaded-identifier";
import {
	AlbumIdentifier,
	AlbumInformationHelper,
	Identity,
	TrackIdentifier,
} from "@sdk";
import { orderIdentifiers } from "src/identifiers/identifiers.util";
import { ExistingDependency } from "src/identifiers/interface/existing-identifier-dependency.interface";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { AlbumIdentificationResult } from "./interface/album-identification-result.interface";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { ArtistsService } from "src/artists/artists.service";
import { TasksService } from "src/tasks/tasks.service";
import { ArtistIdentityTarget } from "src/artists/enum/artist-identity-target.enum";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

@Injectable()
export class AlbumsService {
	private readonly logger = new Logger("Albums Service");
	private readonly identifiers = new Map<
		string,
		Map<string, LoadedIdentifier<AlbumIdentifier>>
	>();
	private orderedIdentifiers: LoadedIdentifier<AlbumIdentifier>[] = [];
	private readonly trackIdentifiers: ExistingDependency[] = [];

	constructor(
		@InjectRepository(DBAlbum)
		private readonly albumsRepository: Repository<DBAlbum>,
		@InjectRepository(DBAlbumIdentity)
		private readonly identitiesRepository: Repository<DBAlbumIdentity>,
		@InjectRepository(DBAlbumArtist)
		private readonly albumArtistsRepository: Repository<DBAlbumArtist>,
		@InjectRepository(DBAlbumTrack)
		private readonly albumTracksRepository: Repository<DBAlbumTrack>,
		private readonly albumManagerService: AlbumManagerService,
		private readonly trackManagerService: TrackManagerService,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly artistsService: ArtistsService,
		private readonly tasksService: TasksService,
		private readonly dataSource: DataSource,
	) {
		this.tasksService.registerSystemTask({
			id: "identify-all-albums",
			resumable: true,
			run: async (context) => {
				await this.identifyAllAlbums(context.getRunId(), (completed, total) => {
					context.update(completed / total);
				});
			},
		});
	}

	public registerIdentifier(identifier: AlbumIdentifier, plugin: LoadedPlugin) {
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

	public async resolveAlbum(
		pluginId: string,
		identifierId: string,
		identity: string,
	): Promise<string> {
		// 1. Check for existing mapping
		const existingIdentity = await this.identitiesRepository.findOne({
			where: {
				pluginId,
				identifierId,
				identity,
			},
			select: ["albumUuid"],
		});

		if (existingIdentity) {
			return existingIdentity.albumUuid;
		}

		// 2. Create a "Headless" Album Stub
		// No title, no artist yet. Just a UUID to anchor future metadata.
		return await this.dataSource.transaction(async (tm) => {
			const albRepo = tm.getRepository(DBAlbum);
			const idRepo = tm.getRepository(DBAlbumIdentity);

			const newAlbum = albRepo.create({
				title: "Unknown Album",
				dateAdded: Date.now(),
			});

			const saved = await albRepo.save(newAlbum);

			await idRepo.insert({
				pluginId,
				identifierId,
				identity,
				albumUuid: saved.uuid,
				ordinal: 0,
			});

			return saved.uuid;
		});
	}

	public async setTrackLinks(
		track: DBTrack,
		albumUuids: string[],
		pluginId: string,
		identifierId: string,
		// Optional: Metadata sources often provide position
		position?: { disc: number; track: number },
	) {
		await this.dataSource.transaction(async (tm) => {
			const atRepo = tm.getRepository(DBAlbumTrack);

			// Clear old links for this specific plugin/identifier to avoid stale data
			await atRepo.delete({
				trackUuid: track.uuid,
				pluginId,
				identifierId,
			});

			if (albumUuids.length > 0) {
				await atRepo.insert(
					albumUuids.map((albumUuid) =>
						atRepo.create({
							trackUuid: track.uuid,
							albumUuid,
							pluginId,
							identifierId,
							discNumber: position?.disc ?? 1,
							trackNumber: position?.track ?? 0,
						}),
					),
				);
			}
		});
	}

	public async clearTrackLinks(
		track: DBTrack,
		pluginId: string,
		identifierId: string,
	) {
		await this.albumTracksRepository.delete({
			trackUuid: track.uuid,
			pluginId,
			identifierId,
		});
	}

	async clearArtistLinks(
		album: DBAlbum,
		pluginId: string,
		identifierId: string,
	) {
		await this.albumArtistsRepository.delete({
			albumUuid: album.uuid,
			pluginId,
			identifierId,
		});
	}

	async setArtistLinks(
		album: DBAlbum,
		artistUuids: string[],
		pluginId: string,
		identifierId: string,
	) {
		await this.clearArtistLinks(album, pluginId, identifierId);
		console.log("Setting artist links:", artistUuids, album);
		await this.albumArtistsRepository.insert(
			artistUuids.map((artistUuid, ordinal) => ({
				albumUuid: album.uuid,
				artistUuid,
				pluginId,
				identifierId,
				ordinal,
			})),
		);
	}

	async setJoinPhrase(
		albumUuid: string,
		artistUuid: string,
		joinPhrase: string | null,
	) {
		await this.albumArtistsRepository.update(
			{
				albumUuid,
				artistUuid,
			},
			{
				joinPhrase,
			},
		);
	}

	findIdentities(album: DBAlbum) {
		return this.identitiesRepository.findBy({
			albumUuid: album.uuid,
		});
	}

	public async getInformationHelper(
		album: DBAlbum,
		getIdentities?: (id: string, pluginId?: string | null) => Identity[] | null,
	): Promise<AlbumInformationHelper> {
		if (!getIdentities) {
			const identities = await this.findIdentities(album);

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
			getAlbumUuid: () => album.uuid,
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

	public async getExternalUrls(album: DBAlbum) {
		const identities = (await this.findIdentities(album)).map((identity) =>
			identity.toIdentity(),
		);
		return this.externalUrlsService.getAlbumUrls({
			getAlbumUuid: () => album.uuid,
			getIdentity: (id, pluginId, multiple) => {
				const matches = identities.filter(
					(identity) =>
						identity.identifierId == id &&
						(!pluginId || pluginId == identity.pluginId),
				);
				if (!matches.length) {
					return null;
				}
				if (multiple) {
					return matches;
				}
				return matches[0]! as any;
			},
		});
	}

	public async identifyAlbum(
		album: DBAlbum,
		runId: string,
	): Promise<AlbumIdentificationResult> {
		if (!this.orderedIdentifiers.length) {
			this.logger.warn(
				`Cannot identify Album "${album.uuid}" because no identifiers are registered`,
			);
			await this.albumManagerService.setRunId(album, runId, "identity");
			return { identities: [], mergedAlbums: [album.uuid] };
		}

		this.logger.debug(
			`Identifying Album "${album.uuid}" using ${this.orderedIdentifiers.length} Identifiers...`,
		);

		const informationHelper = await this.getInformationHelper(album);

		for (const { identifier, plugin } of this.orderedIdentifiers) {
			try {
				const identities = await identifier.identify(
					informationHelper,
					new Logger(`PLUGIN ${plugin.package.name}`),
				);

				if (identities?.length) {
					// todo: i probably only need to upsert identities with "album" target
					await this.identitiesRepository.upsert(
						identities.map((identity, index) => ({
							identifierId: identifier.id,
							pluginId: plugin.package.name,
							albumUuid: album.uuid,
							identity,
							ordinal: index,
						})),
						{
							conflictPaths: [
								"pluginId",
								"identifierId",
								"albumUuid",
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
								ArtistIdentityTarget.ALBUM,
								true,
							);
							artistUuids.push(artistUuid);
						}
						console.log("SETTING ALBUM LINKS:", artistUuids);
						await this.setArtistLinks(
							album,
							artistUuids,
							plugin.package.name,
							identifier.id,
						);
					}
				} else {
					await this.clearArtistLinks(
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
			} catch (e) {
				this.logger.error(
					`An error occured while trying to identify Album "${album.uuid}" with Identifier "${identifier.id}":`,
					e,
				);
			}
		}

		await this.albumManagerService.setRunId(album, runId, "identity");

		return {
			identities: [],
			mergedAlbums: [album.uuid],
		};
	}

	public async identifyAllAlbums(
		runId: string,
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

		const criteria: FindOptionsWhere<DBAlbum>[] = [
			{
				lastIdentificationRunId: Not(runId),
				uuid: Not(In(failedUuids)),
			},
			{
				lastIdentificationRunId: IsNull(),
				uuid: Not(In(failedUuids)),
			},
		];

		const count = await this.albumManagerService.count(criteria);
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

					if (!activeThreads) {
						resolve();
					}
					return;
				}

				try {
					const { identities, mergedAlbums } = await this.identifyAlbum(
						album,
						runId,
					);
					this.logger.debug(
						`Identified ${identities.length} identities to Artist #${completed + 1}`,
					);

					pool = pool.filter((album) => !mergedAlbums.includes(album.uuid));
					completed += mergedAlbums.length;
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
						where: criteria,
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
