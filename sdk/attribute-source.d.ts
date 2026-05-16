import { Readable } from "stream";
import { AttributeValue, Attribute } from "./attribute";
import { Track } from "./audio-types";
import {
	AlbumInformationHelper,
	ArtistInformationHelper,
	TrackAttributionHelper,
	TrackInformationHelper,
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

export interface TrackAttributes {
	track: AttributeValue[] | null;
	artists: ArtistAttributes[] | null;
}

export interface AlbumAttributes {
	album: AttributeValue[] | null;
	artists: ArtistAttributes[] | null;
}

export interface ArtistAttributes {
	pluginId: string;
	identifierId: string;
	identifierValue: string;
	attributes: AttributeValue[];
	joinPhrase?: string | null;
}

export interface AttributeSource {
	readonly id: string;

	enable(attributeSourceApiContext: AttributeSourceApiContext): void;

	getName(): string;

	getTrackAttributeValues(
		helper: TrackAttributionHelper,
	): Promise<TrackAttributes>;

	getArtistAttributeValues(
		helper: ArtistInformationHelper,
	): Promise<AttributeValue[]>;

	getAlbumAttributeValues(
		helper: AlbumInformationHelper,
	): Promise<AlbumAttributes>;
}
