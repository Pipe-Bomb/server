import { AttributeSource } from "./attribute-source";
import { Identifier } from "./identifier";
import { LibraryHandler } from "./library-handler";
import { Logger } from "./logger";
import { Task } from "./task";

export interface PluginApiContext {
	getServerVersion(): string;
	getLogger(): Logger;
	getPluginPackage(): PluginPackage;
	registerLibraryHandler(libraryHandler: LibraryHandler): void;
	registerIdentifier(identifier: Identifier): void;
	registerAttributeSource(attributeSource: AttributeSource): void;
	requestTempDirectory(): Promise<string>;
	registerTask(task: Task): void;
	registerLanguageDirectory(path: string): void;
}
