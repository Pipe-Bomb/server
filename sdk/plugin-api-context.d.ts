import { AttributeSource } from "./attribute-source";
import { AuthClient } from "./auth-client";
import { ConfigManager, UserConfigManager } from "./config-manager";
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
import { PlaylistClient } from "./playlist-client";
import { PluginPackage } from "./plugin";
import { SimpleTask, SubTask } from "./task";

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
	registerTask(task: SimpleTask): void;
	registerTask<T extends string>(task: SubTask<T>): void;
	registerLanguageDirectory(path: string): void;
	registerIconDirectory(path: string): void;
	registerExternalUrlSource(externalUrlSource: ExternalUrlSource): void;
	requestCacheDirectory(): Promise<string>;
	registerConfigManager(configManager: ConfigManager): void;
	registerUserConfigManager(
		id: string,
		userConfigManager: UserConfigManager,
	): void;
	registerEphemeralSource(ephemeralSource: EphemeralSource): void;
	getDataClient(): DataClient;
	requestAuthClient(): AuthClient | null;
	getPlaylistClient(): PlaylistClient;
}
