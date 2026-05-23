import { AttributeValue } from "./attribute";
import {
	AlbumMetadata,
	ArtistMetadata,
	AttributeSource,
	IdentifiableAlbumMetadata,
	IdentifiableTrackArtistMetadata,
} from "./attribute-source";
import { LibraryHandler } from "./library-handler";

export interface EphemeralSourceApiContext {
	useAttributeSource(attributeSource: AttributeSource): void;
	resolveArtistIdentifier(identifierId: string): void;
	resolveAlbumIdentifier(identifierId: string): void;
}

export interface EphemeralSourceSearchOptions {
	query: string;
}

export interface EphemeralTrack {
	id: string;
	title: string;
	attributes: AttributeValue[] | null;
	artists: IdentifiableTrackArtistMetadata[] | null;
}

export interface EphemeralSourceSearchResults {
	tracks: EphemeralTrack[];
	artists: IdentifiableTrackArtistMetadata[];
	albums: IdentifiableAlbumMetadata[];
}

export interface EphemeralArtistContent {
	tracks: EphemeralTrack[] | null;
	albums: IdentifiableAlbumMetadata[] | null;
}

export interface EphemeralAlbumContent {
	tracks: EphemeralTrack[] | null;
}

export interface EphemeralSource {
	readonly id: string;

	enable(
		ephemeralSourceApiContext: EphemeralSourceApiContext,
	): void | Promise<void>;

	getName(): string;

	getLibraryHandler(): LibraryHandler;

	search(
		options: EphemeralSourceSearchOptions,
	): Promise<EphemeralSourceSearchResults>;

	resolveArtist(
		identityId: string,
		identity: string,
	): Promise<ArtistMetadata | null>;

	resolveArtistContent(
		identityId: string,
		identity: string,
	): Promise<EphemeralArtistContent | null>;

	resolveAlbum(
		identityId: string,
		identity: string,
	): Promise<AlbumMetadata | null>;

	resolveAlbumContent(
		identityId: string,
		identity: string,
	): Promise<EphemeralAlbumContent | null>;
}
