import { Readable } from "stream";
import {
	AudioProducer,
	HLSAudioProducer,
	StreamAudioProducer,
} from "./audio-producer";

export interface Identity {
	pluginId: string;
	identifierId: string;
	value: string;
}

export interface LibraryTrackInformationHelper {
	getAudioProducer(): Promise<AudioProducer>;
	getAudioProducer(type: "stream"): Promise<StreamAudioProducer | null>;
	getAudioProducer(type: "hls"): Promise<HLSAudioProducer | null>;
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
	getPluginId(): string;
	getLibraryId(): string;
	getTrackId(): string;
}

export interface TrackAttributionHelper extends TrackInformationHelper {
	getCompletedAttributeKeys(): string[];
}

export interface ArtistInformationHelper {
	getArtistUuid(): string;
	getIdentity(
		id: string,
		pluginId: string | null,
		multiple: true,
	): Identity[] | null;
	getIdentity(
		id: string,
		pluginId?: string | null,
		multiple?: false,
	): Identity | null;
}

export interface AlbumInformationHelper {
	getAlbumUuid(): string;
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

	// getArtists(): Promise<ArtistInformationHelper[]>;
	// getTracks(): Promise<TrackInformationHelper[]>;
}
