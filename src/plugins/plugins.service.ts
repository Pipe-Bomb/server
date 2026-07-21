import { Injectable, Logger } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { isUUID, validate } from "class-validator";
import { existsSync } from "fs";
import { lstat, mkdir, readdir, readFile } from "fs/promises";
import path from "path";
import { PluginPackageDto } from "./dto/plugin-package.dto";
import type Sdk from "@sdk";
import Package from "../../package.json";
import { LoadedPlugin } from "./interface/loaded-plugin.interface";
import { LibrariesService } from "src/libraries/libraries.service";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { randomUUID } from "crypto";
import { TasksService } from "src/tasks/tasks.service";
import { LanguageService } from "src/language/language.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { IconsService } from "src/icons/icons.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { PluginConfigService } from "src/plugin-config/plugin-config.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DataClient, Plugin, Task } from "@sdk";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AudioSessionsService } from "src/audio-sessions/audio-sessions.service";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { PlaylistsService } from "src/playlists/playlists.service";
import { WorkflowsService } from "src/workflows/workflows.service";

@Injectable()
export class PluginsService {
	private readonly pluginsDirectory =
		process.env.PLUGIN_DIRECTORY || path.join(process.cwd(), "plugins");
	private readonly logger = new Logger("Plugins Service");

	private readonly plugins = new Map<string, LoadedPlugin>();
	private readonly waitListeners = new Set<() => void>();
	private isScanning = false;

	constructor(
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
		private readonly tasksService: TasksService,
		private readonly languagesService: LanguageService,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly iconsService: IconsService,
		private readonly externalUrlsService: ExternalUrlsService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly pluginConfigService: PluginConfigService,
		private readonly ephemeralService: EphemeralService,
		private readonly trackManagerService: TrackManagerService,
		private readonly audioSessionsService: AudioSessionsService,
		private readonly userManagerService: UserManagerService,
		private readonly playlistsService: PlaylistsService,
		private readonly workflowsService: WorkflowsService,
	) {
		this.logger.debug(`Plugin directory is "${this.pluginsDirectory}"`);

		this.scan();
	}

	private async scan() {
		if (this.isScanning) {
			return;
		}
		this.isScanning = true;
		try {
			if (!existsSync(this.pluginsDirectory)) {
				this.logger.log(
					`Plugin directory does not exist. Creating... (${this.pluginsDirectory})`,
				);
				await mkdir(this.pluginsDirectory, {
					recursive: true,
				});
			}
		} catch (e) {
			this.logger.fatal(
				`Failed to create plugin directory (${this.pluginsDirectory})`,
				e,
			);
			process.exit(1);
		}

		const pluginDirInfo = await lstat(this.pluginsDirectory);

		if (!pluginDirInfo.isDirectory()) {
			this.logger.fatal(
				`Plugin directory path (${this.pluginsDirectory}) is not a directory`,
			);
			process.exit(1);
		}

		const dirContents = await readdir(this.pluginsDirectory);
		for (const child of dirContents) {
			if (child.startsWith(".")) {
				this.logger.debug(`Ignoring plugin directory "${child}"`);
				continue;
			}
			try {
				this.logger.debug(`Attempting to parse plugin "${child}"...`);
				const pluginDirPath = path.join(this.pluginsDirectory, child);
				const dirInfo = await lstat(pluginDirPath);
				if (!dirInfo.isDirectory()) {
					throw new Error(`Plugin path is not a directory`);
				}

				let packageContents: string;
				try {
					packageContents = await readFile(
						path.join(pluginDirPath, "package.json"),
						"utf-8",
					);
				} catch (e) {
					throw new Error(`Failed to read "package.json"`);
				}

				let packageJson: any;
				try {
					packageJson = JSON.parse(packageContents);
				} catch (e) {
					throw new Error(`"package.json" contains invalid JSON`);
				}

				const pluginPackage = plainToInstance(PluginPackageDto, packageJson);
				const errors = await validate(pluginPackage);

				if (errors.length) {
					this.logger.error(`Issues detected with "package.json":`);
					for (const error of errors) {
						if (error.constraints) {
							for (const constraint of Object.values(error.constraints)) {
								this.logger.error(` - ${constraint}`);
							}
						}
					}
					throw new Error(`Failed to parse "packages.json"`);
				}

				this.logger.log(
					`Loading "${pluginPackage.name}" v${pluginPackage.version} (${child})...`,
				);

				const entryFile = path.join(
					pluginDirPath,
					pluginPackage.pipebombEntry || pluginPackage.main || "index.js",
				);

				const pluginImport = await import(entryFile);

				if (
					!("default" in pluginImport) ||
					typeof pluginImport.default != "function"
				) {
					throw new Error("Entrypoint is invalid");
				}

				const pluginConstructor = pluginImport.default;
				if (!this.isValidPlugin(pluginConstructor)) {
					throw new Error("Entrypoint doesn't expost a valid plugin");
				}

				const plugin = new pluginConstructor();
				this.logger.debug(`Successfully instantiated "${pluginPackage.name}"`);

				const loadedPlugin: LoadedPlugin = {
					plugin,
					package: pluginPackage,
				};
				const pluginApiContext = this.createPluginApiContext(
					loadedPlugin,
					pluginDirPath,
				);
				plugin.enable(pluginApiContext);

				this.plugins.set(pluginPackage.name, loadedPlugin);

				this.logger.log(
					`Enabled "${pluginPackage.name}" v${pluginPackage.version}`,
				);
			} catch (e) {
				this.logger.error(`Failed to load plugin "${child}":`, e);
			}
		}

		this.logger.log(
			`Successfully loaded ${this.plugins.size} plugin${this.plugins.size == 1 ? "" : "s"}`,
		);
		this.isScanning = false;
		for (const listener of this.waitListeners) {
			listener();
		}
		this.waitListeners.clear();
	}

	private createPluginApiContext(
		plugin: LoadedPlugin,
		pluginDirectory: string,
	): Sdk.PluginApiContext {
		const logger = new Logger(`PLUGIN ${plugin.package.name}`);

		return {
			getServerVersion: () => Package.version,
			getLogger: () => logger,
			getPlugin: async (id) => {
				await new Promise<void>((resolve) => {
					if (this.isScanning) {
						this.waitListeners.add(resolve);
					} else {
						resolve();
					}
				});

				const plugin = this.plugins.get(id);
				return (plugin?.plugin as any) ?? null;
			},
			getServerPort: () => 3000, // todo: don't hard code
			getPluginPackage: () => plugin.package,
			requestTempDirectory: async () => {
				let dir: string;
				do {
					dir = path.join("temp", randomUUID());
				} while (existsSync(dir));
				await mkdir(dir);
				return dir;
			},
			requestCacheDirectory: async () => {
				const dir = path.join("plugin-cache", plugin.package.name);
				await mkdir(dir, {
					recursive: true,
				});
				return dir;
			},
			registerLibraryHandler: (handler) =>
				this.librariesService.register(handler, plugin),
			registerTrackIdentifier: (identifier) =>
				this.identifiersService.register(identifier, plugin),
			registerArtistIdentifier: (identifier) =>
				this.artistManagerService.registerIdentifier(identifier, plugin),
			registerAlbumIdentifier: (identifier) =>
				this.albumManagerService.registerIdentifier(identifier, plugin),
			registerTask: (task: Task) =>
				this.tasksService.registerPluginTask(task, plugin),
			registerLanguageDirectory: (directory) => {
				this.languagesService.registerLanguageDirectory(
					path.join(pluginDirectory, directory),
					plugin,
				);
			},
			registerAttributeSource: (source) =>
				this.attributeSourcesService.registerAttributeSource(plugin, source),
			registerIconDirectory: (directory) => {
				this.iconsService.registerIconDirectory(
					path.join(pluginDirectory, directory),
					plugin,
				);
			},
			registerExternalUrlSource: (source) =>
				this.externalUrlsService.registerSource(source, plugin),
			registerConfigManager: (configManager) =>
				this.pluginConfigService.registerConfigManager(configManager, plugin),
			registerUserConfigManager: (id, configManager) =>
				this.pluginConfigService.registerUserConfigManager(
					id,
					configManager,
					plugin,
				),
			registerEphemeralSource: (source) =>
				this.ephemeralService.registerEphemeralSource(source, plugin),
			getDataClient: () => this.createDataClient(),
			requestAuthClient: () => {
				return {
					getUuid: (username) =>
						this.userManagerService.usernameToUuid(username),
					getUsername: (uuid) =>
						this.userManagerService
							.findOne(uuid)
							.then((user) => user?.username ?? null),
					generateUserToken: async (uuid: string) => {
						const user = await this.userManagerService.findOne(uuid);
						if (!user) {
							throw new Error("User not found");
						}
						return this.userManagerService.generateJwt(
							user,
							plugin.package.name,
						);
					},
					getUserFromToken: async (token: string) => {
						const payload = await this.userManagerService.parseJwt(token);
						return payload.sub;
					},
				};
			},
			getPlaylistClient: () =>
				this.playlistsService.createPlaylistClient(plugin),
			getWorkflowClient: () => this.workflowsService.createClient(plugin),
		};
	}

	private createDataClient(): DataClient {
		return {
			getPlugins: () => {
				const plugins: Record<string, Plugin> = {};
				for (const [pluginId, loadedPlugin] of this.plugins.entries()) {
					plugins[pluginId] = loadedPlugin.plugin;
				}
				return plugins;
			},
			getPlugin: (pluginId) => {
				return this.getPlugin(pluginId)?.plugin ?? null;
			},
			getPluginId: (plugin) => {
				for (const [pluginId, loadedPlugin] of this.plugins.entries()) {
					if (loadedPlugin.plugin == plugin) {
						return pluginId;
					}
				}
				return null;
			},
			getResource: async (resourceUuid, resourceExtension) => {
				if (!isUUID(resourceUuid)) {
					throw new Error("Invalid resource UUID");
				}
				if (resourceExtension.includes(".")) {
					throw new Error("Invalid resource extension");
				}
				const filePath = path.join(
					"resources",
					resourceUuid.substring(0, 3),
					`${resourceUuid}.${resourceExtension}`,
				);
				try {
					return await readFile(filePath);
				} catch (e) {
					this.logger.warn(
						`Failed to read resource "${resourceUuid}" (${resourceExtension})`,
						e,
					);
					return null;
				}
			},
			getLibraryHandlerIds: () => {
				const handlers = this.librariesService.allFlat();
				return handlers.map(({ handler, plugin }) => ({
					pluginId: plugin.package.name,
					libraryId: handler.id,
				}));
			},
			getLibraryHandler: (pluginId, libraryId) => {
				return (
					this.librariesService.findLibrary(pluginId, libraryId)?.handler ??
					null
				);
			},
			getUserCount: () => this.userManagerService.count(),
			forEachUserId: async (callback) =>
				this.userManagerService.forEachUserId(callback),
			createAudioSession: async (pluginId, libraryId, trackId, type) => {
				const session = await this.audioSessionsService.createSession(
					pluginId,
					libraryId,
					trackId,
					type,
				);

				return {
					getId: () => session.id,
					getType: () => session.type,
					getAudioProducer: () => session.getProducer(),
				};
			},
			forEachTrackId: async (pluginId, libraryId, callback) => {
				const library = this.librariesService.findLibrary(pluginId, libraryId);
				if (!library) {
					throw new Error("Library does not exist");
				}
				await this.librariesService.forEachTrackId(library, callback);
			},
			forEachAlbumId: (callback) =>
				this.albumManagerService.forEachAlbumId(callback),
			forEachArtistId: (callback) =>
				this.artistManagerService.forEachArtistId(callback),
			getTrackCount: async (pluginId, libraryId) =>
				this.trackManagerService.count({
					pluginId,
					libraryId,
				}),
			getAlbumCount: () => this.albumManagerService.count([]),
			getArtistCount: () => this.artistManagerService.count([]),
			getAlbumUuids: (amount, offset) =>
				this.albumManagerService
					.findMany({ amount, offset, select: ["uuid"] })
					.then((albums) => albums.map(({ uuid }) => uuid)),
			getArtistUuids: (amount, offset) =>
				this.artistManagerService
					.findMany({ amount, offset, select: ["uuid"] })
					.then((artists) => artists.map(({ uuid }) => uuid)),
			getTrack: async (pluginId, libraryId, trackId, { relations } = {}) => {
				const track = await this.trackManagerService.findOne({
					where: {
						pluginId,
						libraryId,
						trackId,
					},
					relationLoadStrategy: "query",
					relations: {
						identities: relations?.identities,
						attributes: relations?.attributes,
						artists: relations?.artists && {
							artist:
								typeof relations.artists == "object"
									? {
											identities: relations.artists.identities,
											attributes: relations.artists.attributes,
										}
									: true,
						},
						albums: relations?.albums && {
							album:
								typeof relations.albums == "object"
									? {
											identities: relations.albums.identities,
											attributes: relations.albums.attributes,
										}
									: true,
						},
					},
				});
				return track?.toSavedResponse() ?? null;
			},
			getAlbum: async (albumUuid, { relations } = {}) => {
				const album = await this.albumManagerService.findOne(albumUuid, {
					withIdentities: relations?.identities,
					withAttributes: relations?.attributes,
					withArtists: !!relations?.artists,
					withArtistIdentities:
						typeof relations?.artists == "object" &&
						relations.artists.identities,
					withArtistAttributes:
						typeof relations?.artists == "object" &&
						relations.artists.attributes,
					withTracks: !!relations?.tracks,
					withTrackIdentities:
						typeof relations?.tracks == "object" && relations.tracks.identities,
					withTrackAttributes:
						typeof relations?.tracks == "object" && relations.tracks.attributes,
					withTrackArtists:
						typeof relations?.tracks == "object" && !!relations.tracks.artists,
					withTrackArtistIdentities:
						typeof relations?.tracks == "object" &&
						typeof relations.tracks.artists == "object" &&
						relations.tracks.artists.identities,
					withTrackArtistAttributes:
						typeof relations?.tracks == "object" &&
						typeof relations.tracks.artists == "object" &&
						relations.tracks.artists.attributes,
				});

				return album?.toSavedResponse() ?? null;
			},
			getArtist: async (artistUuid: string, { relations } = {}) => {
				const artist = await this.artistManagerService.findOne(artistUuid, {
					withIdentities: relations?.identities,
					withAttributes: relations?.attributes,
					withTracks: !!relations?.tracks,
					withTrackIdentities:
						typeof relations?.tracks == "object" && relations.tracks.identities,
					withTrackAttributes:
						typeof relations?.tracks == "object" && relations.tracks.attributes,
					withTrackArtists:
						typeof relations?.tracks == "object" && !!relations.tracks.artists,
					withTrackArtistIdentities:
						typeof relations?.tracks == "object" &&
						typeof relations.tracks.artists == "object" &&
						relations.tracks.artists.identities,
					withTrackArtistAttributes:
						typeof relations?.tracks == "object" &&
						typeof relations.tracks.artists == "object" &&
						relations.tracks.artists.attributes,
					withAlbums: !!relations?.albums,
					withAlbumIdentities:
						typeof relations?.albums == "object" && relations.albums.identities,
					withAlbumAttributes:
						typeof relations?.albums == "object" && relations.albums.attributes,
					withAlbumArtists:
						typeof relations?.albums == "object" && !!relations.albums.artists,
					withAlbumArtistIdentities:
						typeof relations?.albums == "object" &&
						typeof relations.albums.artists == "object" &&
						relations.albums.artists.identities,
					withAlbumArtistAttributes:
						typeof relations?.albums == "object" &&
						typeof relations.albums.artists == "object" &&
						relations.albums.artists.attributes,
					withAlbumTracks:
						typeof relations?.albums == "object" && !!relations.albums.tracks,
					withAlbumTrackIdentities:
						typeof relations?.albums == "object" &&
						typeof relations.albums.tracks == "object" &&
						relations.albums.tracks.identities,
					withAlbumTrackAttributes:
						typeof relations?.albums == "object" &&
						typeof relations.albums.tracks == "object" &&
						relations.albums.tracks.attributes,
				});

				return artist?.toSavedResponse() ?? null;
			},
		};
	}

	private isValidPlugin(candidate: any): candidate is new () => Sdk.Plugin {
		if (typeof candidate !== "function") return false;

		const proto = candidate.prototype;
		return (
			typeof proto?.enable === "function" &&
			typeof proto?.disable === "function"
		);
	}

	public getPlugin(id: string) {
		return this.plugins.get(id) ?? null;
	}
}
