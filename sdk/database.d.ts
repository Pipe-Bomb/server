import { AttributeType, AttributeValue } from "./attribute";
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
	albums: SavedAlbumTrack[] | null;
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

export interface SavedArtist {
	uuid: string;
	tracks: SavedArtistTrack[] | null;
	albums: SavedAlbumArtist[] | null;
	attributes: SavedAttribute[] | null;
	identities: Identity[] | null;
	dateAdded: Date;
}

export interface SavedUser {
	uuid: string;
	username: string;
	playlists: SavedPlaylist[] | null;
}

export interface SavedSmartFilter<
	T extends Exclude<AttributeType, "buffer"> = Exclude<AttributeType, "buffer">,
> {
	uuid: string;
	groupUuid: string;
	group: SavedSmartFilterGroup | null;
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: T;
	value: SavedAttributeValues[T] | null;
	inverse: boolean;
	min: number | null;
	max: number | null;
	partial: boolean | null;
}

export interface SavedSmartFilterGroup {
	uuid: string;
	dateCreated: Date;
	filters: SavedSmartFilter[] | null;
}

export interface SavedPlaylistTrack {
	playlistUuid: string;
	trackUuid: string;
	dateAdded: Date;
	ordinal: number;
	addedByUuid: string | null;
	addedBy: SavedUser | null;
	playlist: SavedPlaylist | null;
	track: SavedTrack | null;
}

export interface SavedPlaylist {
	uuid: string;
	ownerUuid: string;
	owner: SavedUser | null;
	dateCreated: Date;
	attributes: SavedAttribute[] | null;
	filters: SavedSmartFilterGroup[] | null;
	tracks: SavedPlaylistTrack[] | null;
}
