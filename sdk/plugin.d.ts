import { Logger } from "./logger";
import { PluginApiContext } from "./plugin-api-context";

export interface Plugin {
	enable(apiContext: PluginApiContext): void;
	disable(): void;
}

export interface PluginPackage {
	readonly name: string;
	readonly version: string;
	readonly pipebombEntry: string | undefined;
}
