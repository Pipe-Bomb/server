import { Identity } from "./information-helper";
import { LibraryHandler } from "./library-handler";
import type { Plugin } from "./plugin";
import { SavedAlbum, SavedArtist } from "./database";
import { AudioSession } from "./audio-session";
import { AudioProducerType } from "./audio-producer";

export interface DataClient {
	getPlugin(pluginId: string): Plugin | null;
	getPluginId(plugin: Plugin): string | null;
	getPlugins(): Record<string, Plugin>;

	getLibraryHandler(pluginId: string, libraryId: string): LibraryHandler | null;

	createAudioSession(
		pluginId: string,
		libraryId: string,
		trackId: string,
		type: AudioProducerType | null,
	): Promise<AudioSession>;

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

	getAlbumUuids(amount: number, offset?: number): Promise<string[]>;

	forEachArtist(
		callback: (artistUuid: string, cancel: () => void) => void | Promise<void>,
	): Promise<void>;

	getArtistCount(): Promise<number>;

	getArtistUuids(amount: number, offset?: number): Promise<string[]>;

	getTrackIdentities(
		pluginId: string,
		libraryId: string,
		trackId: string,
	): Promise<Identity[] | null>;

	getAlbum(
		uuid: string,
		options?: {
			relations?: {
				identities?: boolean;
				attributes?: boolean;
				artists?:
					| boolean
					| {
							identities?: boolean;
							attributes?: boolean;
					  };
				tracks?:
					| boolean
					| {
							identities?: boolean;
							attributes?: boolean;
							artists?:
								| boolean
								| {
										identities?: boolean;
										attributes?: boolean;
								  };
					  };
			};
		},
	): Promise<SavedAlbum | null>;

	getArtist(
		uuid: string,
		options?: {
			relations?: {
				identities?: boolean;
				attributes?: boolean;
				albums?:
					| boolean
					| {
							identities?: boolean;
							attributes?: boolean;
							tracks?:
								| boolean
								| {
										identities?: boolean;
										attributes?: boolean;
										artists?:
											| boolean
											| {
													identities?: boolean;
													attributes?: boolean;
											  };
								  };
							artists?:
								| boolean
								| {
										identities?: boolean;
										attributes?: boolean;
								  };
					  };
				tracks?:
					| boolean
					| {
							identities?: boolean;
							attributes?: boolean;
							artists?:
								| boolean
								| {
										identities?: boolean;
										attributes?: boolean;
								  };
					  };
			};
		},
	): Promise<SavedArtist | null>;
}
