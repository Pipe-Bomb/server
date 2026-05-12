import { HLSAudioProducer, HLSContainerType, HLSPlaylist } from "@sdk";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { BadRequestException } from "@nestjs/common";
import { StreamInstance } from "./stream-instance";

export class HLSStreamInstance extends StreamInstance<HLSAudioProducer> {
	private readonly segmentMap = new Map<string, string>();
	private cachedManifest: string | null = null;
	private playlist: HLSPlaylist | null = null;

	private generateSegmentId() {
		let id: string;
		do {
			id = randomUUID();
		} while (this.segmentMap.has(id));
		return id;
	}

	getExtension(containerType: HLSContainerType) {
		switch (containerType) {
			case "ts":
				return "ts";
			case "aac":
				return "aac";
			case "fmp4":
				return "m4s";
		}
	}

	getMimeType(segmentId: string): string {
		const extension = segmentId.split(".").pop();

		switch (extension) {
			case "m3u8":
				return "application/vnd.apple.mpegurl";
			case "ts":
				return "video/MP2T";
			case "m4s":
				return "video/iso.segment";
			case "mp4":
				return "video/mp4";
			case "aac":
				return "audio/aac";
			default:
				return "application/octet-stream";
		}
	}

	async getPlaylist(baseUrl: string): Promise<string> {
		// Return cached playlist to save processing and memory
		if (this.cachedManifest) {
			return this.cachedManifest;
		}

		if (!this.playlist) {
			this.playlist = await this.producer.getPlaylist();
		}

		const extension = this.getExtension(this.playlist.containerType);

		const lines = [
			"#EXTM3U",
			`#EXT-X-VERSION:${this.playlist.version}`,
			`#EXT-X-TARGETDURATION:${this.playlist.targetDuration}`,
			`#EXT-X-MEDIA-SEQUENCE:${this.playlist.mediaSequence}`,
		];

		if (this.playlist.playlistType) {
			lines.push(`#EXT-X-PLAYLIST-TYPE:${this.playlist.playlistType}`);
		}

		// Handle Encryption Keys (if applicable)
		if (this.playlist.key) {
			// Note: If you want to proxy the key, you would map a UUID here as well.
			lines.push(
				`#EXT-X-KEY:METHOD=${this.playlist.key.method},URI="${this.playlist.key.uri}"${this.playlist.key.iv ? `,IV=${this.playlist.key.iv}` : ""}`,
			);
		}

		// 1. Process Initialization Segment (Mandatory for fMP4 / SoundCloud)
		if (this.playlist.initSegmentId) {
			const initUuid = this.generateSegmentId();
			this.segmentMap.set(initUuid, this.playlist.initSegmentId);
			lines.push(`#EXT-X-MAP:URI="${baseUrl}/${initUuid}.mp4"`);
		}

		// 2. Process Standard Segments
		for (const segment of this.playlist.segments) {
			const uuid = this.generateSegmentId();
			this.segmentMap.set(uuid, segment.id);

			if (segment.discontinuity) {
				lines.push("#EXT-X-DISCONTINUITY");
			}

			lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
			lines.push(`${baseUrl}/${uuid}.${extension}`);
		}

		lines.push("#EXT-X-ENDLIST");

		this.cachedManifest = lines.join("\n");
		return this.cachedManifest;
	}

	/**
	 * Used by the Audio Controller to resolve a segment or init file request
	 */
	public getInternalId(clientUuid: string): string | undefined {
		return this.segmentMap.get(clientUuid);
	}

	public async getSegment(
		clientUuid: string,
	): Promise<Readable | Buffer | null> {
		if (!this.playlist) {
			throw new BadRequestException("Playlist not generated");
		}

		this.playlist.mediaSequence;

		const internalId = this.getInternalId(clientUuid);
		if (!internalId) {
			return null;
		}

		return this.producer.getSegment(internalId);
	}
}
