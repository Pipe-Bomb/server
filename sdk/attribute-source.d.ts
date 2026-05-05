import { Readable } from "stream";
import { AttributeValue, Attribute } from "./attribute";
import { Track } from "./audio-types";
import { ArtistInformationHelper, TrackInformationHelper } from "./information-helper";
import { PluginTask } from "./task";
import { Logger } from "./logger";

export interface AttributeSourceApiContext {
    registerTrackAttributes(attributes: Attribute[]): void;
    registerArtistAttributes(attributes: Attribute[]): void;
    registerPluginTask(task: PluginTask): void;
    getLogger(): Logger;
}

export interface TrackAttributes {
    track: AttributeValue[] | null;
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
    public readonly id: string;

	enable(attributeSourceApiContext: AttributeSourceApiContext): void;

	getName(): string;

    getTrackAttributeValues(helper: TrackAttributionHelper): Promise<TrackAttributes>;

    getArtistAttributeValues(helper: ArtistInformationHelper): Promise<AttributeValue[]>;
}
