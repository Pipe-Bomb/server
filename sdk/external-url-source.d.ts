import { ArtistInformationHelper, Identity } from "./information-helper";

export interface ExternalUrl {
	name: string;
	url: string;
	iconId: string;
}

interface ExternalUrlHelper {
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

export interface ArtistExternalUrlHelper extends ExternalUrlHelper {
	getArtistUuid(): string;
}

export interface TrackExternalUrlHelper extends ExternalUrlHelper {}

export interface AlbumExternalUrlHelper extends ExternalUrlHelper {
	getAlbumUuid(): string;
}

export interface ExternalUrlSource {
	getArtistUrls(helper: ArtistExternalUrlHelper): ExternalUrl[] | null;
	getTrackUrls(helper: TrackExternalUrlHelper): ExternalUrl[] | null;
	getAlbumUrls(helper: AlbumExternalUrlHelper): ExternalUrl[] | null;
}
