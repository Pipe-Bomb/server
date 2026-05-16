import { ConfigManager } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedConfigManager {
	configManager: ConfigManager;
	plugin: LoadedPlugin;
}
