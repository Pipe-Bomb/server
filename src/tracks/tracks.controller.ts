import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { TracksService } from "./tracks.service";
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "./response/track.response";
import { LibrariesService } from "src/libraries/libraries.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AudioSessionsService } from "src/audio-sessions/audio-sessions.service";
import { StreamInstanceResponse } from "src/streaming-core/response/session.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { TrackIdsDto } from "./dto/track-ids.dto";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralTrackResponse } from "src/ephemeral/response/ephemeral-track.response";

@Controller("tracks")
export class TracksController {
	constructor(
		private readonly tracksService: TracksService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
		private readonly audioSessionsService: AudioSessionsService,
		private readonly ephemeralService: EphemeralService,
	) {}

	@Get(":pluginId/:libraryId/:trackId")
	@ApiOperation({ operationId: "getTrack" })
	@ApiOkResponse({
		type: TrackResponse,
	})
	@ApiNotFoundResponse()
	async findOne(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<TrackResponse | EphemeralTrackResponse> {
		const track = await this.trackManagerService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
			relations: {
				attributes: true,
				identities: true,
				artists: {
					artist: {
						attributes: true,
					},
				},
				albums: {
					album: {
						attributes: true,
					},
				},
			},
		});
		if (track) {
			return track.toResponse();
		}

		const ephemeralSource = this.ephemeralService.find(pluginId, libraryId);
		if (!ephemeralSource) {
			throw new NotFoundException("Track not found");
		}

		const resolvedTracks = await ephemeralSource.source.resolveTracks([
			trackId,
		]);
		if (!resolvedTracks.length) {
			throw new NotFoundException("Track not found");
		}

		const attributeSource = this.ephemeralService.getAttributeSource(
			ephemeralSource.source,
		);

		const trackResponses = await this.ephemeralService.toTracksResponse(
			[resolvedTracks[0]],
			ephemeralSource,
			attributeSource,
		);

		if (!trackResponses.length) {
			throw new NotFoundException("Track not found");
		}
		return trackResponses[0];
	}

	@Post()
	@ApiOperation({ operationId: "getTracks" })
	@ApiOkResponse({
		type: [TrackResponse],
	})
	async findMany(@Body() dto: TrackIdsDto) {
		const tracks = await this.trackManagerService.find({
			where: dto.tracks.map(({ pluginId, libraryId, trackId }) => ({
				pluginId,
				libraryId,
				trackId,
			})),
			relations: {
				attributes: true,
				identities: true,
				artists: {
					artist: {
						attributes: true,
					},
				},
				albums: {
					album: {
						attributes: true,
					},
				},
			},
		});

		return tracks.map((track) => track.toResponse());
	}

	@Get(":pluginId/:libraryId/:trackId/identities")
	@ApiOperation({ operationId: "getTrackIdentities" })
	@ApiOkResponse({
		type: [IdentityResponse],
	})
	@ApiNotFoundResponse()
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
		type: StreamInstanceResponse,
	})
	@ApiNotFoundResponse()
	async getAudioInfo(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<StreamInstanceResponse> {
		const library = this.librariesService.findLibrary(pluginId, libraryId);
		if (!library) {
			throw new NotFoundException("Library not found");
		}

		const session = await this.audioSessionsService.createSession(
			pluginId,
			libraryId,
			trackId,
		);
		return session.toResponse();
	}

	@Get(":pluginId/:libraryId/:trackId/urls")
	@ApiOperation({ operationId: "getTrackExternalUrls" })
	@ApiOkResponse({
		type: [ExternalUrlResponse],
	})
	@ApiNotFoundResponse()
	async getExternalUrls(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<ExternalUrlResponse[]> {
		const track = await this.trackManagerService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
		});
		if (!track) {
			return [];
		}

		return this.tracksService.getExternalUrls(track);
	}
}
