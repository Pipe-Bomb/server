import { AttributeValue, Attribute } from "./attribute";
import {
	AlbumInformationHelper,
	ArtistInformationHelper,
	Identity,
	TrackAttributionHelper,
} from "./information-helper";
import { Logger } from "./logger";
import { Task } from "./task";

export interface AttributeSourceApiContext {
	registerTrackAttributes(attributes: Attribute[]): void;
	registerArtistAttributes(attributes: Attribute[]): void;
	registerAlbumAttributes(attributes: Attribute[]): void;
	registerPluginTask(task: Task): void;
	getLogger(): Logger;
}

export interface TrackMetadata {
	attributes: AttributeValue[] | null;
	artists: IdentifiableTrackArtistMetadata[] | null;
}

export interface AlbumMetadata {
	attributes: AttributeValue[] | null;
	artists: IdentifiableTrackArtistMetadata[] | null;
}

export interface ArtistMetadata {
	attributes: AttributeValue[] | null;
}

export interface TrackArtistMetadata extends ArtistMetadata {
	joinPhrase?: string | null;
}

export type IdentifiableArtistMetadata = ArtistMetadata & Identity;

export type IdentifiableTrackArtistMetadata = TrackArtistMetadata & Identity;

export type IdentifiableAlbumMetadata = AlbumMetadata & Identity;

export interface AttributeSource {
	readonly id: string;

	enable(attributeSourceApiContext: AttributeSourceApiContext): void;

	getName(): string;

	getTrackAttributeValues(
		helper: TrackAttributionHelper,
	): Promise<TrackMetadata>;

	getArtistAttributeValues(
		helper: ArtistInformationHelper,
	): Promise<ArtistMetadata>;

	getAlbumAttributeValues(
		helper: AlbumInformationHelper,
	): Promise<AlbumMetadata>;
}
