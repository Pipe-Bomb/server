import { ConfigManager, UserConfigManager } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedConfigManager {
	configManager: ConfigManager;
	plugin: LoadedPlugin;
}

export interface LoadedUserConfigManager {
	configManager: UserConfigManager;
	id: string;
	plugin: LoadedPlugin;
}
