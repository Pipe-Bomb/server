import { ExternalUrlSource } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedExternalUrlSource {
	source: ExternalUrlSource;
	plugin: LoadedPlugin;
}
