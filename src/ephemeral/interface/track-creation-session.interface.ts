import { DBTrack } from "src/tracks/entities/track.entity";

export interface TrackCreationSession {
	uuid: string;
	promise: Promise<(DBTrack | null)[]>;
	started: number;
	percent: number | null;
	playlistUuids: string[];
}
