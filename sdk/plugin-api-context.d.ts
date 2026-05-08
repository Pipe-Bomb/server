import { AttributeSource } from "./attribute-source";
import { ExternalUrlSource } from "./external-url-source";
import { ArtistIdentifier, TrackIdentifier } from "./identifier";
import { LibraryHandler } from "./library-handler";
import { Logger } from "./logger";
import { Task } from "./task";

export interface PluginApiContext {
	getServerVersion(): string;
	getLogger(): Logger;
	getPluginPackage(): PluginPackage;
	registerLibraryHandler(libraryHandler: LibraryHandler): void;
	registerTrackIdentifier(identifier: TrackIdentifier): void;
	registerArtistIdentifier(identifier: ArtistIdentifier): void;
	registerAttributeSource(attributeSource: AttributeSource): void;
	requestTempDirectory(): Promise<string>;
	registerTask(task: Task): void;
	registerLanguageDirectory(path: string): void;
	registerIconDirectory(path: string): void;
	registerExternalUrlSource(externalUrlSource: ExternalUrlSource);
	requestCacheDirectory(): Promise<string>;
}
