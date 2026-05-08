import { Task } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedTask {
	task: Task;
	uuid: string;
	plugin: LoadedPlugin | null;
}
