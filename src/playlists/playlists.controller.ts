import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Patch,
	Put,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { PlaylistsService } from "./playlists.service";
import { CreatePlaylistDto } from "./dto/create-playlist.dto";
import { AuthGuard } from "src/users/auth.guard";
import { ReqUser } from "src/users/user.decorator";
import { FetchUserPipe } from "src/users/user.pipe";
import { DBUser } from "src/users/entity/user.entity";
import { AttributeUploadService } from "src/attributes/attribute-upload.service";
import { PlaylistResponse } from "./response/playlist.response";
import {
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AddPlaylistTracksDto } from "./dto/add-playlist-tracks.dto";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { In } from "typeorm";
import { NewPlaylistTrackDto } from "./dto/new-playlist-track.dto";
import { LibrariesService } from "src/libraries/libraries.service";

@Controller("playlists")
export class PlaylistsController {
	constructor(
		private readonly playlistsService: PlaylistsService,
		private readonly attributeUploadService: AttributeUploadService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
	) {}

	@Put()
	@ApiOperation({ operationId: "createPlaylist" })
	@UseGuards(AuthGuard)
	@ApiUnauthorizedResponse()
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	async createPlaylist(
		@Body() dto: CreatePlaylistDto,
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<PlaylistResponse> {
		const playlist = await this.playlistsService.create(user, dto.attributes);
		return playlist.toResponse();
	}

	@Get()
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: [PlaylistResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiOperation({ operationId: "getOwnPlaylists" })
	async getOwnPlaylists(
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<PlaylistResponse[]> {
		const playlists = await this.playlistsService.findForUser(user, {
			withAttributes: true,
		});

		return playlists.map((playlist) => playlist.toResponse());
	}

	@Get(":uuid")
	@ApiOperation({ operationId: "getPlaylist" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	async getPlaylist(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<PlaylistResponse> {
		const playlist = await this.playlistsService.findByUuid(uuid, {
			withAttributes: true,
			withTracks: true,
			withTrackArtists: true,
			withTrackAttributes: true,
			withOwner: true,
		});

		if (!playlist) {
			throw new NotFoundException("Playlist not found");
		}
		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		return playlist.toResponse();
	}

	@Patch(":uuid/add")
	@ApiOperation({ operationId: "addTracksToPlaylist" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async addTracks(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
		@Body() dto: AddPlaylistTracksDto,
	): Promise<PlaylistResponse> {
		const playlist = await this.playlistsService.findByUuid(uuid);

		if (!playlist) {
			throw new NotFoundException("Playlist not found");
		}
		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		const tracks = this.librariesService.resolveTracks(dto.tracks, false); // todo: set to true
		const foundTracks = (await tracks).filter((track) => !!track);

		if (foundTracks.length) {
			await this.playlistsService.addTracks(playlist, foundTracks, user);
		}

		return this.getPlaylist(playlist.uuid, user);
	}

	@Delete(":uuid")
	@ApiOperation({ operationId: "deletePlaylist" })
	@UseGuards(AuthGuard)
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	async deletePlaylist(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const playlist = await this.playlistsService.findByUuid(uuid);

		if (!playlist) {
			throw new NotFoundException("Playlist not found");
		}
		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		await this.playlistsService.delete(playlist);
	}
}
