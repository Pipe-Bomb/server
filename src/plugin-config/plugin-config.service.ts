import { Injectable, Logger } from "@nestjs/common";
import { ConfigManager } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedConfigManager } from "./interface/loaded-config-manager.interface";

@Injectable()
export class PluginConfigService {
	private readonly logger = new Logger("Plugin Config Service");
	private readonly configManagers = new Map<string, LoadedConfigManager>();

	registerConfigManager(configManager: ConfigManager, plugin: LoadedPlugin) {
		if (this.configManagers.has(plugin.package.name)) {
			throw new Error("Plugin has already registered a Config Manager");
		}

		this.configManagers.set(plugin.package.name, {
			configManager,
			plugin,
		});

		this.logger.debug(
			`Plugin "${plugin.package.name}" registered a Config Manager`,
		);
	}

	all() {
		return Array.from(this.configManagers.values());
	}

	find(pluginId: string) {
		return this.configManagers.get(pluginId) ?? null;
	}
}
