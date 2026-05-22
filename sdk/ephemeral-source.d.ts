import { AttributeValue } from "./attribute";
import { ArtistAttributes, AttributeSource } from "./attribute-source";
import { Track } from "./audio-types";
import { LibraryHandler } from "./library-handler";

export interface EphemeralSourceApiContext {
	// useTrackIdentifier(trackIdentifier: TrackIdentifier): void;
	useAttributeSource(attributeSource: AttributeSource): void;
	resolveArtistIdentifier(identifierId: string): void;
}

export interface EphemeralSourceSearchOptions {
	query: string;
}

export interface EphemeralTrack extends Track {
	attributes: AttributeValue[] | null;
	artists: ArtistAttributes[] | null;
}

export interface EphemeralArtist {
	attributes: AttributeValue[];
}

export interface EphemeralSourceSearchResults {
	tracks: EphemeralTrack[];
}

export interface EphemeralArtistContent {
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
		identifierId: string,
		identity: string,
	): Promise<EphemeralArtist | null>;

	resolveArtistContent(
		identifierid: string,
		identity: string,
	): Promise<EphemeralArtistContent | null>;
}
