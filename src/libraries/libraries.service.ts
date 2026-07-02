import { Injectable, Logger } from "@nestjs/common";
import {
	AudioProducerType,
	LibraryHandler,
	TrackInformationHelper,
} from "@sdk";
import { AttributesService } from "src/attributes/attributes.service";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { ILibraryFindResult } from "./interface/library-find-result.interface";
import { TasksService } from "src/tasks/tasks.service";
import { LoadedLibraryHandler } from "./interface/loaded-library.interface";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import {
	FindOptionsSelect,
	FindOptionsSelectByString,
	FindOptionsWhere,
	In,
	IsNull,
	Not,
} from "typeorm";
import { AudioCacheService } from "src/audio-cache/audio-cache.service";
import { TrackId } from "src/tracks/interface/track-id.interface";

interface PluginLibraries {
	readonly plugin: LoadedPlugin;
	readonly libraries: Map<string, LoadedLibraryHandler>;
}

@Injectable()
export class LibrariesService {
	private readonly logger = new Logger("Libraries Service");
	private readonly libraries = new Map<string, PluginLibraries>();

	constructor(
		private readonly trackManagerService: TrackManagerService,
		private readonly attributesService: AttributesService,
		private readonly tasksService: TasksService,
		private readonly identifiersService: IdentifiersService,
		private readonly audioCacheService: AudioCacheService,
	) {
		this.tasksService.registerSystemTask({
			id: "scan-all-libraries",
			resumable: false,
			run: async (context) => {
				const libraries = this.allFlat();
				const sectionPercent = 1 / libraries.length;

				for (const [index, library] of libraries.entries()) {
					const startPercent = sectionPercent * index;
					context.update(startPercent);

					await library.handler.scan({
						update: (percent) => {
							context.update(
								startPercent +
									(Math.max(Math.min(percent, 1), 0) * sectionPercent) / 2,
							);
						},
						getRunId: () => context.getRunId(),
					});

					let chunks = 0;
					const CHUNK_SIZE = 1_000;

					const where: FindOptionsWhere<DBTrack>[] = [
						{
							pluginId: library.plugin.package.name,
							libraryId: library.handler.id,
							lastScanRunId: IsNull(),
						},
						{
							pluginId: library.plugin.package.name,
							libraryId: library.handler.id,
							lastScanRunId: Not(context.getRunId()),
						},
					];

					const toVerifyCount = await this.trackManagerService.count(where);
					const toDelete = new Set<string>();

					while (true) {
						const tracks = await this.trackManagerService.find({
							where,
							take: CHUNK_SIZE,
							skip: CHUNK_SIZE * chunks++,
							select: ["trackId"],
						});
						if (!tracks.length) {
							break;
						}
						const trackIds = new Set(tracks.map((track) => track.trackId));
						const validatedTrackIds = await library.handler.doTracksExist(
							Array.from(trackIds),
						);
						for (const trackId of validatedTrackIds) {
							trackIds.delete(trackId);
						}
						for (const removedId of trackIds) {
							toDelete.add(removedId);
						}

						const percent = (CHUNK_SIZE * chunks) / toVerifyCount;
						context.update(
							startPercent +
								(Math.max(Math.min(percent, 1), 0) * sectionPercent) / 2 +
								sectionPercent / 2,
						);
					}

					this.logger.debug(
						`Removing ${toDelete.size} Tracks from Library "${library.handler.id}" from Plugin "${library.plugin.package.name}"`,
					);

					await this.trackManagerService.removeTracks(
						library.plugin,
						library.handler,
						Array.from(toDelete),
					);
				}
			},
		});

		this.tasksService.registerSystemTask<"all" | "new">({
			id: "identify-tracks",
			resumable: true,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				const libraries = this.allFlat();
				const sectionPercent = 1 / libraries.length;

				for (const [index, library] of libraries.entries()) {
					const startPercent = sectionPercent * index;

					context.update(startPercent);
					await this.identify(
						library,
						context.getRunId(),
						subTaskId == "new",
						(completed, total) => {
							context.update(
								startPercent + (sectionPercent * completed) / total,
							);
						},
					);
				}
			},
		});

		this.tasksService.registerSystemTask<"all" | "new">({
			id: "attribute-tracks",
			resumable: true,
			getSubTasks: () => ["all", "new"],
			run: async (context, subTaskId) => {
				const libraries = this.allFlat();
				const sectionPercent = 1 / libraries.length;

				for (const [index, library] of libraries.entries()) {
					const startPercent = sectionPercent * index;

					context.update(startPercent);
					await this.attribute(
						library,
						context.getRunId(),
						subTaskId == "new",
						(completed, total) => {
							context.update(
								startPercent + (sectionPercent * completed) / total,
							);
						},
					);
				}
			},
		});

		this.tasksService.registerSystemTask({
			id: "cache-all-libraries",
			resumable: false,
			run: async (context) => {
				const libraries = this.allFlat();
				context.update(0);
				for (const [index, library] of libraries.entries()) {
					await this.cache(library, (completed, total) =>
						context.update((index + completed / total) / libraries.length),
					);
				}
			},
		});
	}

	public findLibrary(plugin: string | LoadedPlugin, libraryId: string) {
		if (typeof plugin != "string") {
			plugin = plugin.package.name;
		}

		const pluginLibs = this.libraries.get(plugin);
		if (pluginLibs) {
			const library = pluginLibs.libraries.get(libraryId);
			if (library) {
				return library;
			}
		}

		return null;
	}

	public all() {
		return Array.from(this.libraries.values());
	}

	allFlat() {
		return this.all().flatMap(({ libraries }) =>
			Array.from(libraries.values()),
		);
	}

	public getCount(library: LoadedLibraryHandler) {
		const { handler, plugin } = library;
		return this.trackManagerService.count({
			libraryId: handler.id,
			pluginId: plugin.package.name,
		});
	}

	public async findTracks(
		library: LoadedLibraryHandler,
		options: {
			amount: number;
			offset?: number;
			withAttributes?: boolean;
			withIdentities?: boolean;
			withArtists?: boolean;
			withAlbums?: boolean;
			select?: FindOptionsSelect<DBTrack> | FindOptionsSelectByString<DBTrack>;
		},
	): Promise<ILibraryFindResult> {
		const { handler, plugin } = library;
		const tracks = await this.trackManagerService.find({
			where: {
				libraryId: handler.id,
				pluginId: plugin.package.name,
			},
			select: options.select,
			relationLoadStrategy: "query",
			relations: {
				artists: options.withArtists && {
					artist: {
						attributes: true,
					},
				},
				identities: options.withIdentities,
				attributes: options.withAttributes,
				albums: options.withAlbums && {
					album: {
						attributes: true,
					},
				},
			},
			take: options.amount,
			skip: options.offset,
		});

		return { tracks };
	}

	public async forEachTrack(
		library: LoadedLibraryHandler,
		callback: (trackId: string, cancel: () => void) => void | Promise<void>,
	) {
		const CHUNK_SIZE = 1_000;

		let isCancelled = false;

		for (let i = 0; true; i++) {
			if (isCancelled) {
				return;
			}
			const { tracks } = await this.findTracks(library, {
				amount: CHUNK_SIZE,
				offset: CHUNK_SIZE * i,
				select: ["trackId"],
			});
			if (!tracks.length || isCancelled) {
				break;
			}
			for (const track of tracks) {
				await callback(track.trackId, () => {
					isCancelled = true;
				});
				if (isCancelled) {
					return;
				}
			}
		}
	}

	public register(handler: LibraryHandler, plugin: LoadedPlugin) {
		const pluginLibs = this.libraries.get(plugin.package.name);

		const informationHelper = async (track: DBTrack) => {
			const helper: TrackInformationHelper = {
				getAudioProducer: async (type?: AudioProducerType) => {
					const producer = await this.audioCacheService.getAudioProducer(
						handler,
						track.pluginId,
						track.trackId,
						type ?? null,
					);

					if (type) {
						if (!producer) {
							return null;
						}
						if (producer.type != type) {
							this.logger.error(
								`Library Handler "${handler.id}" from Plugin "${plugin.package.name}" returned an Audio Producer of the wrong type`,
							);
							return null as any;
						}
						return producer;
					}
					if (!producer) {
						throw new Error(
							`Library Handler "${handler.id}" from Plugin "${plugin.package.name}" didn't return an Audio Producer`,
						);
					}
					return producer;
				},
				getTrackUuid: () => track.uuid,
				getPluginId: () => track.pluginId,
				getLibraryId: () => track.libraryId,
				getTrackId: () => track.trackId,
				getIdentity: async (id, pluginId, multiple) => {
					// todo: optimize for single grabs
					const identities = await this.identifiersService.getTrackIdentity(
						track,
						id,
						pluginId ?? null,
					);
					if (!identities.length) {
						return null;
					}
					if (multiple) {
						return identities.map((identity) => ({
							pluginId: identity.pluginId,
							identifierId: identity.identifierId,
							identity: identities[0].identity,
						}));
					}
					return {
						pluginId: identities[0].pluginId,
						identifierId: identities[0].identifierId,
						identity: identities[0].identity,
					} as any;
				},
			};

			return helper;
		};

		if (pluginLibs) {
			if (pluginLibs.libraries.has(handler.id)) {
				throw new Error(
					`Plugin has already registered Library with ID "${handler.id}"`,
				);
			}
			pluginLibs.libraries.set(handler.id, {
				handler,
				plugin,
				informationHelper,
			});
		} else {
			this.libraries.set(plugin.package.name, {
				plugin,
				libraries: new Map([
					[handler.id, { handler, plugin, informationHelper }],
				]),
			});
		}
		handler.enable({
			addTrack: (track, runId) =>
				this.trackManagerService.addTrack(plugin, handler, track, runId),
			removeTrack: async (trackId) => {
				await this.trackManagerService.removeTracks(plugin, handler, [trackId]);
			},
			useAttributeSource: (attributeSource) => {
				throw new Error("Not implemented"); // todo: implement
				// this.attributesService.registerAttributeSource(plugin, attributeSource);
			},
			registerPluginTask: (task) =>
				this.tasksService.registerPluginTask(task, plugin),
		});
		this.logger.log(
			`Plugin "${plugin.package.name}" registered Library "${handler.id}"`,
		);
	}

	async attribute(
		library: LoadedLibraryHandler,
		runId: string,
		onlyNew: boolean,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 5;

		const criteria: FindOptionsWhere<DBTrack>[] = [
			{
				lastAttributionRunId: IsNull(),
				libraryId: library.handler.id,
				pluginId: library.plugin.package.name,
			},
		];

		if (!onlyNew) {
			criteria.push({
				lastAttributionRunId: Not(runId),
				libraryId: library.handler.id,
				pluginId: library.plugin.package.name,
			});
		}

		const count = await this.trackManagerService.count(criteria);
		this.logger.debug(`Attributing ${count} tracks`);
		if (!count) {
			return;
		}

		const trackPool: DBTrack[] = [];
		let activeThreads = 0;
		let isFindingTracks = false;
		let chunksLoaded = 0;
		let allChunksLoaded = false;
		let completedTracks = 0;
		const toSetRunId: DBTrack[] = [];
		const recentIds = new Set<string>();

		return new Promise<void>((resolve, reject) => {
			const handle = async () => {
				activeThreads++;
				const track = trackPool.shift();
				if (!track) {
					activeThreads--;
					increaseTrackPool();

					if (!activeThreads && allChunksLoaded) {
						resolve();
					}
					return;
				}

				recentIds.add(track.uuid);

				try {
					const attributes = await this.attributesService.attributeTrack(
						track,
						library,
					);
					this.logger.debug(
						`Attributed ${attributes.length} attributes to Library track #${completedTracks + 1}`,
					);
				} catch (e) {
					this.logger.debug(
						`Failed to attribute to Library track #${completedTracks + 1}:`,
						e,
					);
				}
				toSetRunId.push(track);
				if (toSetRunId.length >= CHUNK_SIZE) {
					const updateList = toSetRunId.splice(0, toSetRunId.length);
					try {
						await this.trackManagerService.setRunId(
							updateList,
							runId,
							"attribute",
						);
					} catch (e) {
						this.logger.error(e);
					}
					setTimeout(() => {
						for (const track of updateList) {
							recentIds.delete(track.uuid);
						}
					}, 30_000);
				}

				onProgress?.(++completedTracks, count);
				activeThreads--;
				setImmediate(handle);
			};

			const increaseTrackPool = () => {
				if (isFindingTracks || allChunksLoaded) {
					return;
				}

				const recentIdArray = Array.from(recentIds);

				isFindingTracks = true;
				this.trackManagerService
					.find({
						where: criteria.map((criteria) => ({
							...criteria,
							uuid: Not(In(recentIdArray)),
						})),
						take: CHUNK_SIZE,
						relations: {
							artists: true,
						},
					})
					.then((tracks) => {
						if (tracks.length) {
							trackPool.push(...tracks);
							isFindingTracks = false;
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

			increaseTrackPool();
		});
	}

	async identify(
		library: LoadedLibraryHandler,
		runId: string,
		onlyNew: boolean,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;

		const criteria: FindOptionsWhere<DBTrack>[] = [
			{
				lastIdentificationRunId: IsNull(),
				libraryId: library.handler.id,
				pluginId: library.plugin.package.name,
			},
		];

		if (!onlyNew) {
			criteria.push({
				lastIdentificationRunId: Not(runId),
				libraryId: library.handler.id,
				pluginId: library.plugin.package.name,
			});
		}

		const count = await this.trackManagerService.count(criteria);

		for (let i = 0; i * 30 < count; i++) {
			const tracks = await this.trackManagerService.find({
				where: criteria,
				take: CHUNK_SIZE,
			});

			if (!tracks.length) {
				break;
			}

			for (const [index, track] of tracks.entries()) {
				await this.identifiersService.identifyTrack(track, library);
				onProgress?.(index + i * CHUNK_SIZE, count);
			}
			await this.trackManagerService.setRunId(tracks, runId, "identity");
		}
	}

	async cache(
		library: LoadedLibraryHandler,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 5;
		// const MAX_THREADS = 1;

		const count = await this.getCount(library);
		this.logger.debug(`Caching ${count} tracks...`);
		if (!count) {
			return;
		}

		const trackPool: DBTrack[] = [];
		let activeThreads = 0;
		let isFindingTracks = false;
		let chunksLoaded = 0;
		let allChunksLoaded = false;
		let completedTracks = 0;

		return new Promise<void>((resolve, reject) => {
			const handle = async () => {
				activeThreads++;
				const track = trackPool.shift();
				if (!track) {
					activeThreads--;
					increaseTrackPool();

					if (!activeThreads && allChunksLoaded) {
						resolve();
					}
					return;
				}

				try {
					const isCached = await this.audioCacheService.cacheTrack(
						library,
						track,
					);
					if (isCached) {
						this.logger.debug(`Cached Library track #${completedTracks + 1}`);
					}
				} catch (e) {
					this.logger.debug(
						`Failed to cache Library track #${completedTracks + 1}:`,
						e,
					);
				}

				onProgress?.(++completedTracks, count);
				activeThreads--;
				setImmediate(handle);
			};

			const increaseTrackPool = () => {
				if (isFindingTracks || allChunksLoaded) {
					return;
				}

				isFindingTracks = true;

				this.findTracks(library, {
					amount: CHUNK_SIZE,
					offset: CHUNK_SIZE * chunksLoaded++,
				})
					.then(({ tracks }) => {
						if (tracks.length) {
							trackPool.push(...tracks);
							isFindingTracks = false;
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

			increaseTrackPool();
		});
	}

	async resolveTracks(trackIds: TrackId[]) {
		const pluginMap = new Map<string, Map<string, Map<string, number>>>();

		for (const [index, id] of trackIds.entries()) {
			let plugin = pluginMap.get(id.pluginId);
			if (!plugin) {
				if (!this.libraries.has(id.pluginId)) {
					throw new Error("Plugin doesn't exist");
				}
				plugin = new Map();
				pluginMap.set(id.pluginId, plugin);
			}
			let library = plugin.get(id.libraryId);
			if (!library) {
				const libraries = this.libraries.get(id.pluginId);
				if (!libraries) {
					throw new Error("Plugin doesn't exist");
				}
				if (!libraries.libraries.has(id.libraryId)) {
					throw new Error("Library doesn't exist");
				}
				library = new Map();
				plugin.set(id.libraryId, library);
			}
			if (!library.has(id.trackId)) {
				library.set(id.trackId, index);
			}
		}

		const output: (DBTrack | null)[] = Array(trackIds.length).fill(null);

		const chunks: TrackId[][] = [];
		for (const [index, trackId] of trackIds.entries()) {
			if (chunks.length <= index) {
				chunks[index] = [trackId];
			} else {
				chunks[index].push(trackId);
			}
		}

		const tracks: DBTrack[] = [];
		for (const chunk of chunks) {
			const trackChunk = await this.trackManagerService.find({
				where: chunk.map(({ pluginId, libraryId, trackId }) => ({
					pluginId,
					libraryId,
					trackId,
				})),
			});
			tracks.push(...trackChunk);
		}

		for (const track of tracks) {
			const library = pluginMap.get(track.pluginId)?.get(track.libraryId);
			if (!library) {
				continue;
			}

			const index = library.get(track.trackId);
			if (index !== undefined) {
				output[index] = track;
				library.delete(track.trackId);
			}
		}

		return output;
	}

	async clearStaleLibraries() {
		const libraries: { pluginId: string; libraryId: string }[] = [];

		for (const [pluginId, entry] of this.libraries) {
			for (const libraryId of entry.libraries.keys()) {
				libraries.push({ pluginId, libraryId });
			}
		}

		if (!libraries.length) {
			await this.trackManagerService.deleteAll();
			return;
		}

		const conditionStrings: string[] = [];
		const queryParameters: Record<string, string> = {};

		for (const [index, { pluginId, libraryId }] of libraries.entries()) {
			const pluginKey = `p_${index}`;
			const libraryKey = `l_${index}`;

			conditionStrings.push(
				`(pluginId = :${pluginKey} AND libraryId = :${libraryKey})`,
			);

			queryParameters[pluginKey] = pluginId;
			queryParameters[libraryKey] = libraryId;
		}

		await this.trackManagerService
			.queryBuilder()
			.delete()
			.from(DBTrack)
			.where(`NOT (${conditionStrings.join(" OR ")})`, queryParameters)
			.execute();
	}
}
