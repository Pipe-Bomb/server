import {
	Controller,
	Get,
	Headers,
	HttpStatus,
	NotFoundException,
	Param,
	Res,
	StreamableFile,
} from "@nestjs/common";
import { TracksService } from "./tracks.service";
import {
	ApiHeader,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiPartialContentResponse,
	ApiProduces,
	ApiRequestedRangeNotSatisfiableResponse,
	ApiResponse,
} from "@nestjs/swagger";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "./response/track.response";
import type { Response } from "express";
import { LibrariesService } from "src/libraries/libraries.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";

@Controller("tracks")
export class TracksController {
	constructor(
		private readonly tracksService: TracksService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
	) {}

	@Get(":pluginId/:libraryId/:trackId")
	@ApiOperation({ operationId: "getTrack" })
	@ApiOkResponse({
		type: TrackResponse,
	})
	async findOne(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	) {
		const track = await this.trackManagerService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
			relations: {
				attributes: true,
			},
		});
		return track?.toResponse() ?? null;
	}

	@Get(":pluginId/:libraryId/:trackId/identities")
	@ApiOperation({ operationId: "getTrackIdentities" })
	@ApiOkResponse({
		type: [IdentityResponse],
	})
	async getIdentities(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<IdentityResponse[]> {
		const track = await this.trackManagerService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
		});
		if (!track) {
			throw new NotFoundException("Track not found");
		}
		const identities = await this.identifiersService.getTrackIdentities(track);
		return identities.map((identity) => identity.toResponse());
	}

	@Get(":pluginId/:libraryId/:trackId/audio")
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
	async streamAudio(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
		@Headers("Range") range: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const library = this.librariesService.findLibrary(pluginId, libraryId);
		if (!library) {
			throw new NotFoundException("Library not found");
		}

		const track = await this.trackManagerService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
			relations: {
				attributes: true,
			},
		});

		if (!track) {
			throw new NotFoundException("Track not found");
		}

		const producer = await library.handler.getAudioProducer({
			id: track.trackId,
			title: track.title,
		});

		const metadata = await producer.getMetadata();

		if (!range) {
			const stream = await producer.getStream();

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

		const stream = await producer.getPart(start, end);
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
}
