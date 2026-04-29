import {Readable} from "stream";
import { TrackInformationHelper } from "./information-helper";

export interface IdentifierDependency {
    pluginId: string | null;
    sourceId: string;
}

export type IdentifierTarget = "track" | "artist" | "album";

export interface Identifier {
    public readonly id: string;
    public readonly target: IdentifierTarget;

    identify(helper: TrackInformationHelper): Promise<string[] | null>;

    getDependencies(): IdentifierDependency[];
    getSoftDependencies(): IdentifierDependency[];
}