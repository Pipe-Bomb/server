import { Readable } from "stream";

export interface LibraryTrackInformationHelper {
	getStream(): Readable | null | Promise<Readable | null>;
	getDuration(): number | null | Promise<number | null>;
}

export interface Identity {
	pluginId: string;
	identifierId: string;
	value: string;
}

export interface TrackInformationHelper extends LibraryTrackInformationHelper {
	getTrackUuid(): string;
	getIdentity(
		id: string,
		pluginId: string | null,
		multiple: true,
	): Promise<Identity[] | null>;
	getIdentity(
		id: string,
		pluginId?: string | null,
		multiple?: false,
	): Promise<Identity | null>;
}
