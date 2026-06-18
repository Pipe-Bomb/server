import { Identity } from "./information-helper";
import { LibraryHandler } from "./library-handler";
import type { Plugin } from "./plugin";

export interface DataClient {
	getPlugin(pluginId: string): Plugin | null;
	getPluginId(plugin: Plugin): string | null;
	getPlugins(): Record<string, Plugin>;

	getLibraryHandler(pluginId: string, libraryId: string): LibraryHandler | null;

	getTrackCount(pluginId: string, libraryId: string): Promise<number>;

	forEachTrack(
		pluginId: string,
		libraryId: string,
		callback: (trackId: string, cancel: () => void) => void | Promise<void>,
	): Promise<void>;

	forEachAlbum(
		callback: (albumUuid: string, cancel: () => void) => void | Promise<void>,
	): Promise<void>;

	getAlbumCount(): Promise<number>;

	forEachArtist(
		callback: (artistUuid: string, cancel: () => void) => void | Promise<void>,
	): Promise<void>;

	getArtistCount(): Promise<number>;

	getTrackIdentities(
		pluginId: string,
		libraryId: string,
		trackId: string,
	): Promise<Identity[] | null>;

	getAlbumIdentities(albumUuid: string): Promise<Identity[] | null>;

	getArtistIdentities(artistUuid: string): Promise<Identity[] | null>;
}
