import { Injectable, Logger } from "@nestjs/common";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedIcon } from "./interface/loaded-icon.interface";
import { readdir, lstat } from "fs/promises";
import path from "path";

const EXTENSION_WHITELIST: string[] = ["svg", "png", "jpg", "jpeg"] as const;

@Injectable()
export class IconsService {
	private readonly logger = new Logger("Icons Service");
	private readonly icons = new Map<string, Map<string, LoadedIcon>>();

	public async registerIconDirectory(directory: string, plugin: LoadedPlugin) {
		readdir(directory, {
			recursive: true,
		})
			.then(async (contents) => {
				let map = this.icons.get(plugin.package.name);
				if (!map) {
					map = new Map();
					this.icons.set(plugin.package.name, map);
				}

				for (const file of contents) {
					try {
						const stats = await lstat(path.join(directory, file));
						if (!stats.isFile()) {
							continue;
						}

						const extension = path.extname(file).substring(1).toLowerCase();
						if (!EXTENSION_WHITELIST.includes(extension)) {
							this.logger.warn(
								`Refused to register Icon "${file}" from Plugin "${plugin.package.name}" because its file extension is not whitelisted`,
							);
							continue;
						}

						const name = path.basename(file, `.${extension}`);
						if (map.has(name)) {
							this.logger.warn(
								`Refused to register duplicate Icon "${file}" from Plugin "${plugin.package.name}"`,
							);
							continue;
						}
						map.set(name, {
							id: name,
							path: path.join(directory, file),
							extension,
							plugin,
						});
						this.logger.debug(
							`Registered Icon "${name}" from Plugin "${plugin.package.name}"`,
						);
					} catch (e) {
						this.logger.error(
							`Failed to register Icon "${directory}" from Plugin "${plugin.package.name}":`,
							e,
						);
					}
				}
			})
			.catch((e) => {
				this.logger.error(
					`Failed to register Icon directory from Plugin "${plugin.package.name}":`,
					e,
				);
			});
	}

	getIcon(pluginId: string, iconId: string) {
		const pluginMap = this.icons.get(pluginId);
		if (pluginMap) {
			const icon = pluginMap.get(iconId);
			if (icon) {
				return icon;
			}
		}
		return null;
	}
}
