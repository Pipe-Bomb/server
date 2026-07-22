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
import { StreamingCoreService } from "./streaming-core.service";
import { StreamInstance } from "./stream-instance/stream-instance";
import { AudioProducer } from "@sdk";
import {
	ApiHeader,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiPartialContentResponse,
	ApiProduces,
	ApiRequestedRangeNotSatisfiableResponse,
} from "@nestjs/swagger";
import { StreamStreamInstance } from "./stream-instance/stream.stream-instance";
import type { Request, Response } from "express";
import { HLSStreamInstance } from "./stream-instance/hls.stream-instance";
import { getBaseUrl } from "src/util/request.util";
import { OptionalAuth } from "src/user-manager/optional-auth.decorator";

@Controller("streaming")
export class StreamingCoreController {
	constructor(private readonly streamingCoreService: StreamingCoreService) {}

	private get<T extends StreamInstance<AudioProducer>>(
		id: string,
		type: AudioProducer["type"],
	) {
		const instance = this.streamingCoreService.getInstance(id);
		if (instance) {
			if (instance.type != type) {
				throw new BadRequestException("Stream Instance is of different type");
			}
			return instance as T;
		}
		throw new NotFoundException("Stream Instance not found");
	}

	@Get(":id/stream")
	@OptionalAuth()
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
		const session = this.get<StreamStreamInstance>(id, "stream");

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
	@OptionalAuth()
	@Header("Content-Type", "application/vnd.apple.mpegurl")
	async getHLSPlaylist(@Param("id") id: string, @Req() req: Request) {
		const session = this.get<HLSStreamInstance>(id, "hls");

		const baseUrl = `${getBaseUrl(req)}/streaming/${session.id}/hls/segment`;

		const playlist = await session.getPlaylist(baseUrl);

		return playlist;
	}

	@Get(":id/hls/segment/:segmentId")
	@OptionalAuth()
	async getHLSSegment(
		@Param("id") id: string,
		@Param("segmentId") segmentId: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const instance = this.get<HLSStreamInstance>(id, "hls");

		const segment = await instance.getSegment(segmentId.split(".")[0]!);

		if (!segment) {
			throw new NotFoundException("Segment not found");
		}

		res.setHeader("Content-Type", instance.getMimeType(segmentId));

		if (Buffer.isBuffer(segment)) {
			return new StreamableFile(segment);
		}
		return new StreamableFile(segment);
	}
}
