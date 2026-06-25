import { Injectable, Logger } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
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
import { DataClient, Plugin } from "@sdk";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { toSimplifiedAttributeList } from "src/attributes/attributes.util";
import { SavedAttribute } from "sdk/database";
import { AudioSessionsService } from "src/audio-sessions/audio-sessions.service";

@Injectable()
export class PluginsService {
	private readonly pluginsDirectory =
		process.env.PLUGIN_DIRECTORY || path.join(process.cwd(), "plugins");
	private readonly logger = new Logger("Plugins Service");

	private readonly plugins = new Map<string, LoadedPlugin>();

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
	) {
		this.logger.debug(`Plugin directory is "${this.pluginsDirectory}"`);

		this.scan();
	}

	private async scan() {
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
	}

	private createPluginApiContext(
		plugin: LoadedPlugin,
		pluginDirectory: string,
	): Sdk.PluginApiContext {
		const logger = new Logger(`PLUGIN ${plugin.package.name}`);

		return {
			getServerVersion: () => Package.version,
			getLogger: () => logger,
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
			registerTask: (task) =>
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
			registerEphemeralSource: (source) =>
				this.ephemeralService.registerEphemeralSource(source, plugin),
			getDataClient: () => this.createDataClient(),
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
			getLibraryHandler: (pluginId, libraryId) => {
				return (
					this.librariesService.findLibrary(pluginId, libraryId)?.handler ??
					null
				);
			},
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
			forEachTrack: async (pluginId, libraryId, callback) => {
				const library = this.librariesService.findLibrary(pluginId, libraryId);
				if (!library) {
					throw new Error("Library does not exist");
				}
				await this.librariesService.forEachTrack(library, callback);
			},
			forEachAlbum: (callback) =>
				this.albumManagerService.forEachAlbum(callback),
			forEachArtist: (callback) =>
				this.artistManagerService.forEachArtist(callback),
			getTrackCount: async (pluginId, libraryId) =>
				this.trackManagerService.count({
					pluginId,
					libraryId,
				}),
			getAlbumCount: () => this.albumManagerService.count([]),
			getArtistCount: () => this.artistManagerService.count([]),
			getAlbumUuids: (amount, offset) =>
				this.albumManagerService
					.findMany({ amount, offset })
					.then((albums) => albums.map(({ uuid }) => uuid)),
			getArtistUuids: (amount, offset) =>
				this.artistManagerService
					.findMany({ amount, offset })
					.then((artists) => artists.map(({ uuid }) => uuid)),
			getTrackIdentities: async (pluginId, libraryId, trackId) => {
				const track = await this.trackManagerService.findOne({
					where: {
						pluginId,
						libraryId,
						trackId,
					},
				});
				if (!track) {
					return null;
				}

				const identities =
					await this.identifiersService.getTrackIdentities(track);
				return identities.map((identity) => identity.toIdentity());
			},
			getAlbum: async (albumUuid: string, { relations } = {}) => {
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
