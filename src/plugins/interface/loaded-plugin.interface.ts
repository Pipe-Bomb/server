import Sdk from "@sdk";
import { PluginUpdateStatus } from "../enum/plugin-update-status.enum";

export interface LoadedPlugin {
	package: Sdk.PluginPackage;
	plugin: Sdk.Plugin;
	directoryPath: string;
	updateStatus: PluginUpdateStatus;
}
