import { LibraryHandler, TrackInformationHelper } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBTrack } from "src/tracks/entities/track.entity";

export interface LoadedLibraryHandler {
	handler: LibraryHandler;
	plugin: LoadedPlugin;
	informationHelper(track: DBTrack): Promise<TrackInformationHelper>;
}
