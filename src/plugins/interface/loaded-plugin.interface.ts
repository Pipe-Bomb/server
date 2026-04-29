import Sdk from "@sdk";

export interface LoadedPlugin {
	package: Sdk.PluginPackage;
	plugin: Sdk.Plugin;
}
