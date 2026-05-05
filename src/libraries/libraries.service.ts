import { Injectable, Logger } from "@nestjs/common";
import { LibraryHandler, TrackInformationHelper } from "@sdk";
import { AttributesService } from "src/attributes/attributes.service";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { TracksService } from "src/tracks/tracks.service";
import { ILibraryFindResult } from "./interface/library-find-result.interface";
import { TasksService } from "src/tasks/tasks.service";
import { LoadedLibraryHandler } from "./interface/loaded-library.interface";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";

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
	) {
		this.tasksService.registerSystemTask({
			id: "scan-all-libraries",
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
									Math.max(Math.min(percent, 1), 0) * sectionPercent,
							);
						},
					});
				}
			},
		});

		this.tasksService.registerSystemTask({
			id: "identify-all-libraries",
			run: async (context) => {
				const libraries = this.allFlat();
				const sectionPercent = 1 / libraries.length;

				for (const [index, library] of libraries.entries()) {
					const startPercent = sectionPercent * index;

					context.update(startPercent);
					await this.identify(library, (completed, total) => {
						context.update(startPercent + (sectionPercent * completed) / total);
					});
				}
			},
		});

		this.tasksService.registerSystemTask({
			id: "attribute-all-libraries",
			run: async (context) => {
				const libraries = this.allFlat();
				const sectionPercent = 1 / libraries.length;

				for (const [index, library] of libraries.entries()) {
					const startPercent = sectionPercent * index;

					context.update(startPercent);
					await this.attribute(library, (completed, total) => {
						context.update(startPercent + (sectionPercent * completed) / total);
					});
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
		},
	): Promise<ILibraryFindResult> {
		const { handler, plugin } = library;
		const tracks = await this.trackManagerService.find({
			where: {
				libraryId: handler.id,
				pluginId: plugin.package.name,
			},
			relations: {
				artists: options.withArtists && {
					artist: {
						attributes: true,
					},
				},
				identities: options.withIdentities,
				attributes: options.withAttributes,
			},
			take: options.amount,
			skip: options.offset,
		});

		return { tracks };
	}

	public register(handler: LibraryHandler, plugin: LoadedPlugin) {
		const pluginLibs = this.libraries.get(plugin.package.name);

		const informationHelper = async (track: DBTrack) => {
			const helper: TrackInformationHelper = {
				...(await handler.getInformationHelper(track.toResponse())),
				getTrackUuid: () => track.uuid,
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
							value: identities[0].identity,
						}));
					}
					return {
						pluginId: identities[0].pluginId,
						identifierId: identities[0].identifierId,
						value: identities[0].identity,
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
			addTrack: (track) =>
				this.trackManagerService.addTrack(plugin, handler, track),
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
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;
		const MAX_THREADS = 5;

		const count = await this.getCount(library);
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

					if (!activeThreads) {
						resolve();
					}
					return;
				}

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
					withArtists: true,
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

	async identify(
		library: LoadedLibraryHandler,
		onProgress?: (completed: number, total: number) => void,
	) {
		const CHUNK_SIZE = 30;

		const count = await this.getCount(library);

		for (let i = 0; i * 30 < count; i++) {
			const { tracks } = await this.findTracks(library, {
				amount: CHUNK_SIZE,
				offset: CHUNK_SIZE * i,
			});

			if (!tracks.length) {
				break;
			}

			for (const [index, track] of tracks.entries()) {
				await this.identifiersService.identifyTrack(track, library);
				onProgress?.(index + i * CHUNK_SIZE, count);
			}
		}
	}
}
