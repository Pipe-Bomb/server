import {
	BadRequestException,
	Controller,
	Get,
	Header,
	Headers,
	HttpStatus,
	NotFoundException,
	Param,
	Req,
	Res,
	StreamableFile,
} from "@nestjs/common";
import { AudioSessionsService } from "./audio-sessions.service";
import { AudioProducer } from "@sdk";
import { Session } from "./session/session";
import type { Request, Response } from "express";
import { StreamSession } from "./session/stream.session";
import {
	ApiHeader,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiPartialContentResponse,
	ApiProduces,
	ApiRequestedRangeNotSatisfiableResponse,
} from "@nestjs/swagger";
import { HLSSession } from "./session/hls.session";

@Controller("audio-sessions")
export class AudioSessionsController {
	constructor(private readonly audioSessionsService: AudioSessionsService) {}

	private get<T extends Session<AudioProducer>>(
		id: string,
		type: AudioProducer["type"],
	) {
		const session = this.audioSessionsService.getSession(id);
		if (session) {
			if (session.type != type) {
				throw new BadRequestException("Session is of different type");
			}
			return session as T;
		}
		throw new NotFoundException("Session not found");
	}

	@Get(":id/stream")
	@ApiHeader({
		name: "Range",
		description: "Byte range for seeking (e.g., bytes=0-1024)",
		required: false,
		schema: { type: "string", example: "bytes=0-1024" },
	})
	@ApiProduces("audio/mpeg", "audio/ogg", "audio/flac")
	@ApiOkResponse({
		description: "Returns the full audio file when no range is requested",
		content: {
			"audio/*": {
				schema: {
					type: "string",
					format: "binary",
				},
			},
		},
	})
	@ApiPartialContentResponse({
		description: "Partial content when a valid range is provided",
		headers: {
			"Content-Range": {
				description: "The range of bytes sent and the total size of the file",
				schema: { type: "string", example: "bytes 0-99/3539613" },
			},
			"Accept-Ranges": {
				description: "Indicates that the server supports range requests",
				schema: { type: "string", example: "bytes" },
			},
			"Content-Length": {
				description: "Size of the chunk being returned",
				schema: { type: "number" },
			},
		},
		content: {
			"audio/*": {
				schema: {
					type: "string",
					format: "binary",
				},
			},
		},
	})
	@ApiNotFoundResponse({ description: "Library or Track not found" })
	@ApiRequestedRangeNotSatisfiableResponse({
		description: "Requested Range Not Satisfiable",
	})
	async getStream(
		@Param("id") id: string,
		@Headers("Range") range: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const session = this.get<StreamSession>(id, "stream");

		const metadata = await session.getMetadata();

		if (!range) {
			const stream = await session.getStream();

			res.set({
				"Content-Type": metadata.mimeType,
				"Content-Length": metadata.size,
				"Accept-Ranges": "bytes",
			});

			return new StreamableFile(stream);
		}

		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : metadata.size - 1;

		if (start >= metadata.size || end >= metadata.size) {
			res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
			res.set("Content-Range", `bytes */${metadata.size}`);
			return;
		}

		const stream = await session.getPart(start, end);
		const chunkSize = end - start + 1;

		res.status(HttpStatus.PARTIAL_CONTENT);
		res.set({
			"Content-Range": `bytes ${start}-${end}/${metadata.size}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunkSize,
			"Content-Type": metadata.mimeType,
		});

		if (Buffer.isBuffer(stream)) {
			return stream;
		}
		return new StreamableFile(stream);
	}

	@Get(":id/hls/playlist.m3u8")
	@Header("Content-Type", "application/vnd.apple.mpegurl")
	async getHLSPlaylist(@Param("id") id: string, @Req() req: Request) {
		const session = this.get<HLSSession>(id, "hls");

		const host = req.get("host") || req.headers.host;
		if (!host) {
			throw new Error("Host not found");
		}
		const baseUrl = `${req.protocol}://${host}/audio-sessions/${session.id}/hls/segment`;

		const playlist = await session.getPlaylist(baseUrl);

		return playlist;
	}

	@Get(":id/hls/segment/:segmentId")
	async getHLSSegment(
		@Param("id") id: string,
		@Param("segmentId") segmentId: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const session = this.get<HLSSession>(id, "hls");

		const segment = await session.getSegment(segmentId.split(".")[0]!);

		if (!segment) {
			throw new NotFoundException("Segment not found");
		}

		if (Buffer.isBuffer(segment)) {
			return segment;
		}
		return new StreamableFile(segment);
	}
}
