import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	Param,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import { TracksService } from "./tracks.service";
import {
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
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
import { SavedTracksService } from "./saved-tracks.service";
import { ReqUser } from "src/users/user.decorator";
import { FetchUserPipe } from "src/users/user.pipe";
import { DBUser } from "src/users/entity/user.entity";
import { TrackCreationSessionResponse } from "src/ephemeral/response/track-creation-session.response";
import { SavedTracksResponse } from "./response/saved-tracks.response";

@Controller("tracks")
export class TracksController {
	private readonly logger = new Logger("Tracks Controller");

	constructor(
		private readonly tracksService: TracksService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly identifiersService: IdentifiersService,
		private readonly audioSessionsService: AudioSessionsService,
		private readonly ephemeralService: EphemeralService,
		private readonly savedTracksService: SavedTracksService,
	) {}

	@Get("saved")
	@ApiOperation({ operationId: "getSavedTracks" })
	@ApiOkResponse({
		type: SavedTracksResponse,
	})
	@ApiUnauthorizedResponse()
	async getSavedTracks(
		@Query("pageSize") pageSize?: string,
		@Query("page") page?: string,
		@ReqUser(FetchUserPipe) user?: DBUser,
	): Promise<SavedTracksResponse> {
		const size = Math.min(
			Math.max(parseInt(pageSize ?? "20", 10) || 20, 1),
			30,
		);
		const pageNum = Math.max(parseInt(page ?? "1", 10) || 1, 1);
		const { tracks, count } = await this.savedTracksService.getSavedTracks(
			user ?? null,
			{
				amount: size,
				offset: (pageNum - 1) * size,
				withAttributes: true,
				withIdentities: true,
				withArtists: true,
				withAlbums: true,
			},
		);

		return {
			tracks: tracks
				.filter((entry) => entry.track)
				.map((entry) => entry.track!.toResponse()),
			total: count,
		};
	}

	@Get("saved/pending")
	@ApiOperation({ operationId: "getSavedTracksPending" })
	@ApiOkResponse({
		type: TrackCreationSessionResponse,
		isArray: true,
	})
	@ApiUnauthorizedResponse()
	async getSavedTracksPending(@ReqUser(FetchUserPipe) user?: DBUser) {
		if (!user) {
			return [];
		}

		const sessions = this.ephemeralService.getCreationSessionsByUserUuid(
			user.uuid,
		);
		return sessions.map((session) =>
			this.ephemeralService.toCreationSessionResponse(session),
		);
	}

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

		let resolvedTracks: Awaited<
			ReturnType<typeof ephemeralSource.source.resolveTracks>
		>;
		try {
			resolvedTracks = await ephemeralSource.source.resolveTracks([trackId]);
		} catch (e) {
			this.logger.error(
				`Ephemeral Source "${ephemeralSource.source.id}" from Plugin "${ephemeralSource.plugin.package.name}" failed to resolve track "${trackId}":`,
				e,
			);
			throw new InternalServerErrorException("Failed to resolve track");
		}
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
	@HttpCode(HttpStatus.OK)
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
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
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

	@Put(":pluginId/:libraryId/:trackId/save")
	@ApiOperation({ operationId: "saveTrack" })
	@ApiOkResponse()
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async saveTrack(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const track = await this.trackManagerService.findOne({
			where: { pluginId, libraryId, trackId },
		});
		if (track) {
			await this.savedTracksService.saveTrack(track, user);
			return;
		}

		const sessionUuid = await this.savedTracksService.saveEphemeralTrack(
			pluginId,
			libraryId,
			trackId,
			user,
		);

		if (sessionUuid) {
			return { sessionUuid };
		}
	}

	@Delete(":pluginId/:libraryId/:trackId/save")
	@ApiOperation({ operationId: "unsaveTrack" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async unsaveTrack(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const track = await this.trackManagerService.findOne({
			where: { pluginId, libraryId, trackId },
		});
		if (!track) {
			throw new NotFoundException("Track not found");
		}

		await this.savedTracksService.unsaveTrack(track, user);
	}
}
