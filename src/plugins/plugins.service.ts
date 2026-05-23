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
import { ArtistsService } from "src/artists/artists.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { IconsService } from "src/icons/icons.service";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { AlbumsService } from "src/albums/albums.service";
import { PluginConfigService } from "src/plugin-config/plugin-config.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

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
