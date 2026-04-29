import { Readable } from "stream";
import { AttributeValue, Attribute } from "./attribute";
import { Track } from "./audio-types";
import { TrackInformationHelper } from "./information-helper";
import { PluginTask } from "./task";

export interface AttributeSourceApiContext {
    registerTrackAttributes(attributes: Attribute[]): void;
    registerArtistAttributes(attributes: Attribute[]): void;
    registerPluginTask(task: PluginTask): void;
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

    getTrackAttributeValues(helper: TrackInformationHelper): Promise<TrackAttributes>;
}
