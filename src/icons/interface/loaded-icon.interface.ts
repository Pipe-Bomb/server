import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedIcon {
	plugin: LoadedPlugin;
	path: string;
	extension: string;
	id: string;
}
