import { Readable } from "stream";

export type AudioProducerType = "stream" | "hls";

export interface StreamAudioMetadata {
	size: number;
	mimeType: string;
}

export interface StreamAudioProducer {
	type: "stream";

	readonly cacheable: boolean;

	getMetadata(): Promise<StreamAudioMetadata>;

	getDuration(): Promise<number>;

	getStream(): Promise<Readable>;

	getPart(start: number, end: number): Promise<Buffer | Readable>;
}

export interface HLSSegment {
	id: string; // Internal ID (e.g., "seg-0")
	duration: number; // Duration in seconds
	discontinuity?: boolean; // For ad insertions or stream breaks
	byteRange?: {
		length: number;
		offset?: number;
	};
}

export interface HLSKey {
	method: "AES-128" | "SAMPLE-AES" | "NONE";
	uri: string; // The original key URI or an internal ID if proxied
	iv?: string; // Initialization Vector
	keyFormat?: string;
}

export type HLSContainerType = "fmp4" | "ts" | "aac";

export interface HLSPlaylist {
	version: number;
	targetDuration: number;
	mediaSequence: number;
	playlistType?: "VOD" | "EVENT";
	initSegmentId?: string; // Universal ID for the init file (fMP4 support)
	key?: HLSKey;
	segments: HLSSegment[];
	containerType: HLSContainerType;
}

export interface HLSAudioMetadata {
	duration: number;
	mimeType: string;
}

export interface HLSAudioProducer {
	type: "hls";

	readonly cacheable: boolean;

	getMetadata(): Promise<HLSAudioMetadata>;

	getPlaylist(): Promise<HLSPlaylist>;

	getSegment(name: string): Promise<Buffer | Readable>;
}

export type AudioProducer = StreamAudioProducer | HLSAudioProducer;
