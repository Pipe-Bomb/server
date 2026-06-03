import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import { FindOptionsWhere, In, IsNull, Not, Repository } from "typeorm";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
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
			return { identities: [], mergedAlbums: [album.uuid] };
		}

		this.logger.debug(
			`Identifying Album "${album.uuid}" using ${identifiers.length} Identifiers...`,
		);

		const informationHelper =
			await this.albumManagerService.getInformationHelper(album);

		for (const { identifier, plugin } of identifiers) {
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

					if (!activeThreads && allChunksLoaded) {
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
