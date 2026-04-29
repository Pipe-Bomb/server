import { AttributeSource } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

export interface LoadedAttributeSource {
	source: AttributeSource;
	plugin: LoadedPlugin;
}
