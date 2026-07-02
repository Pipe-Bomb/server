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
		this.tasksService.registerSystemTask<"all" | "new">({
			id: "identify-artists",
			resumable: true,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				await this.identifyAllArtists(
					context.getRunId(),
					subTaskId == "new",
					(completed, total) => {
						context.update(completed / total);
					},
				);
			},
		});
	}

	public async identifyAllArtists(
		runId: string,
		onlyNew: boolean,
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
