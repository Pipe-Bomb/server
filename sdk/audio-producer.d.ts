import { Readable } from "stream";

export interface AudioMetadata {
	size: number;
	mimeType: string;
}

export interface AudioProducer {
	getMetadata(): Promise<AudioMetadata>;

	getStream(): Promise<Readable>;

	getPart(start: number, end: number): Promise<Buffer | Readable>;
}
