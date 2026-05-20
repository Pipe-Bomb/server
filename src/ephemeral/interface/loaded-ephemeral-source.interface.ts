import { EphemeralSource } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedEphemeralSource {
	source: EphemeralSource;
	plugin: LoadedPlugin;
}
