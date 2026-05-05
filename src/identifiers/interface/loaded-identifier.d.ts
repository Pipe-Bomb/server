import { Identifier } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

interface LoadedIdentifier<T extends Identifier> {
	plugin: LoadedPlugin;
	identifier: T;
}
