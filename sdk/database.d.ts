import { RelativeUrl } from "src/interception/relative-url";
import { AttributeType } from "./attribute";
import { Identity } from "./information-helper";

export type SavedAttributeValues = {
	string: string;
	integer: number;
	decimal: number;
	boolean: boolean;
	buffer: {
		uuid: string;
		url: string;
		extension: string;
	};
};

export type SavedAttribute<T extends AttributeType = AttributeType> = {
	[K in T]: {
		key: string;
		type: K;
		values: SavedAttributeValues[K][];
		pluginId: string;
		sourceId: string;
	};
}[T];

export interface SavedTrack {
	uuid: string;
	pluginId: string;
	libraryId: string;
	trackId: string;
	title: string;
	attributes: SavedAttribute[] | null;
	identities: Identity[] | null;
	artists: SavedArtistTrack[] | null;
}

export interface SavedAlbumTrack {
	trackUuid: string;
	albumUuid: string;
	track: SavedTrack | null;
	album: SavedAlbum | null;
	discNumber: number;
	trackNumber: number;
	pluginId: string;
	identifierId: string;
}

export interface SavedAlbum {
	uuid: string;
	tracks: SavedAlbumTrack[] | null;
	attributes: SavedAttribute[] | null;
	identities: Identity[] | null;
	dateAdded: Date;
	artists: SavedAlbumArtist[] | null;
}

export interface SavedArtistTrack {
	trackUuid: string;
	artistUuid: string;
	ordinal: number;
	pluginId: string;
	identifierId: string;
	track: SavedTrack | null;
	artist: SavedArtist | null;
	joinPhrase: string | null;
}

export interface SavedAlbumArtist {
	albumUuid: string;
	artistUuid: string;
	ordinal: number;
	pluginId: string;
	identifierId: string;
	album: SavedAlbum | null;
	artist: SavedArtist | null;
	joinPhrase: string | null;
}

export class SavedArtist {
	uuid: string;
	tracks: SavedArtistTrack[] | null;
	albums: SavedAlbumArtist[] | null;
	attributes: SavedAttribute[] | null;
	identities: Identity[] | null;
	dateAdded: Date;
}
