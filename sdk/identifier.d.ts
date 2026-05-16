import { Readable } from "stream";
import {
	AlbumInformationHelper,
	ArtistInformationHelper,
	TrackInformationHelper,
} from "./information-helper";
import { Logger } from "./logger";

export interface IdentifierDependency {
	pluginId: string | null;
	sourceId: string;
}

export type TrackIdentifierTarget = "track" | "artist" | "album";
export type AlbumIdentifierTarget = "artist" | "album";

export interface Identifier {
	readonly id: string;

	getDependencies(): IdentifierDependency[];
	getSoftDependencies(): IdentifierDependency[];
}

export interface TrackIdentifier extends Identifier {
	readonly target: TrackIdentifierTarget;

	identify(
		helper: TrackInformationHelper,
		logger: Logger,
	): Promise<string[] | null>;
}

export interface ArtistIdentifier extends Identifier {
	identify(
		helper: ArtistInformationHelper,
		logger: Logger,
	): Promise<string[] | null>;
}

export interface AlbumIdentifier extends Identifier {
	readonly target: AlbumIdentifierTarget;

	identify(
		helper: AlbumInformationHelper,
		logger: Logger,
	): Promise<string[] | null>;
}
