import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, In, IsNull, Not, Repository } from "typeorm";
import { TasksService } from "src/tasks/tasks.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { DBArtist } from "src/artist-manager/entity/artist.entity";

@Injectable()
export class ArtistsService {
	private readonly logger = new Logger("Artists Service");

	constructor(
		private readonly artistManagerService: ArtistManagerService,
		private readonly tasksService: TasksService,
		@InjectRepository(DBArtist)
		private readonly artistsRepository: Repository<DBArtist>,
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

		const count = await this.artistManagerService.count(criteria);
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

					if (!activeThreads && allChunksLoaded) {
						resolve();
					}
					return;
				}

				try {
					const { mergedArtists, identities } =
						await this.artistManagerService.identifyArtist(artist, runId);
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
}
