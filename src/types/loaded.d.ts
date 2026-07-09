import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface Loaded<T> {
	plugin: LoadedPlugin;
	object: T;
}

export interface OptionalLoaded<T> {
	plugin: LoadedPlugin | null;
	object: T;
}
