import { AttributeSource } from "./attribute-source";
import { AuthClient } from "./auth-client";
import { ConfigManager } from "./config-manager";
import { DataClient } from "./data-client";
import { EphemeralSource } from "./ephemeral-source";
import { ExternalUrlSource } from "./external-url-source";
import {
	AlbumIdentifier,
	ArtistIdentifier,
	TrackIdentifier,
} from "./identifier";
import { LibraryHandler } from "./library-handler";
import { Logger } from "./logger";
import { PluginPackage } from "./plugin";
import { Task } from "./task";

export interface PluginApiContext {
	getServerVersion(): string;
	getServerPort(): number;
	getLogger(): Logger;
	getPluginPackage(): PluginPackage;
	registerLibraryHandler(libraryHandler: LibraryHandler): void;
	registerTrackIdentifier(identifier: TrackIdentifier): void;
	registerArtistIdentifier(identifier: ArtistIdentifier): void;
	registerAlbumIdentifier(identifier: AlbumIdentifier): void;
	registerAttributeSource(attributeSource: AttributeSource): void;
	requestTempDirectory(): Promise<string>;
	registerTask(task: Task): void;
	registerLanguageDirectory(path: string): void;
	registerIconDirectory(path: string): void;
	registerExternalUrlSource(externalUrlSource: ExternalUrlSource): void;
	requestCacheDirectory(): Promise<string>;
	registerConfigManager(configManager: ConfigManager): void;
	registerEphemeralSource(ephemeralSource: EphemeralSource): void;
	getDataClient(): DataClient;
	requestAuthClient(): AuthClient | null;
}
