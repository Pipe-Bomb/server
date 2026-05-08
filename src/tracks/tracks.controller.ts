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
	getSchemaPath,
} from "@nestjs/swagger";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "./response/track.response";
import type { Response } from "express";
import { LibrariesService } from "src/libraries/libraries.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { StreamAudioProducer } from "@sdk";
import { AudioSessionsService } from "src/audio-sessions/audio-sessions.service";
import { SessionResponse } from "src/audio-sessions/response/session.response";

@Controller("tracks")
export class TracksController {
	constructor(
		private readonly tracksService: TracksService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
		private readonly audioSessionsService: AudioSessionsService,
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
	@ApiOperation({ operationId: "createTrackAudioSession" })
	@ApiOkResponse({
		type: SessionResponse,
	})
	async getAudioInfo(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<SessionResponse> {
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

		const session = await this.audioSessionsService.createSession(track);
		return session.toResponse();
	}
}
