import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { DBTrack } from "src/tracks/entities/track.entity";

export interface ILibraryFindResult {
	tracks: DBTrack[];
}
