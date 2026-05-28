import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
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
import { NewPlaylistTrackDto } from "./dto/new-playlist-track.dto";
import { LibrariesService } from "src/libraries/libraries.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { TrackCreationSessionResponse } from "src/ephemeral/response/track-creation-session.response";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

@Controller("playlists")
export class PlaylistsController {
	private readonly logger = new Logger("Playlists Controller");

	constructor(
		private readonly playlistsService: PlaylistsService,
		private readonly attributeUploadService: AttributeUploadService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly ephemeralService: EphemeralService,
		private readonly albumManagerService: AlbumManagerService,
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

		const tracks: (DBTrack | null)[] = [];
		const missingTracks: (NewPlaylistTrackDto & { index: number })[] = [];

		const resolveTracks = async (toLookup: NewPlaylistTrackDto[]) => {
			const resolved = await this.librariesService.resolveTracks(toLookup);
			const offset = tracks.length;
			tracks.push(...resolved);

			for (const [index, track] of resolved.entries()) {
				if (!track) {
					missingTracks.push({
						...toLookup[index],
						index: index + offset,
					});
				}
			}
		};

		if (dto.tracks?.length) {
			await resolveTracks(dto.tracks);
		}

		if (dto.albums?.length) {
			for (const albumInfo of dto.albums) {
				if (albumInfo.uuid) {
					const album = await this.albumManagerService.findOne(albumInfo.uuid, {
						withTracks: true,
					});
					if (!album) {
						throw new NotFoundException("Album not found");
					}
					if (album.tracks) {
						tracks.push(...album.tracks.map(({ track }) => track!));
					}
				} else if (
					albumInfo.pluginId &&
					albumInfo.identityId &&
					albumInfo.identity
				) {
					const ephemeralSource =
						this.ephemeralService.getEphemeralSourceByAlbumIdentity(
							albumInfo.pluginId,
							albumInfo.identityId,
						);
					if (!ephemeralSource) {
						throw new NotFoundException("Ephemeral Album not found");
					}
					const content = await ephemeralSource.source.resolveAlbumContent(
						albumInfo.identityId,
						albumInfo.identity,
					);
					if (!content) {
						throw new NotFoundException("Ephemeral Album not found");
					}
					if (content.tracks?.length) {
						await resolveTracks(
							content.tracks.map((track) => ({
								pluginId: ephemeralSource.plugin.package.name,
								libraryId: ephemeralSource.source.getLibraryHandler().id,
								trackId: track.id,
							})),
						);
					}
				} else {
					throw new BadRequestException(
						"Album had no identifiable information",
					);
				}
			}
		}

		const session = await this.ephemeralService.createTracks(missingTracks, {
			playlistUuids: [playlist.uuid],
		});

		session.promise.then(async (newTracks) => {
			for (const [i, track] of newTracks.entries()) {
				const index = missingTracks[i].index;
				tracks[index] = track;
			}

			const foundTracks = tracks.filter((track) => !!track);

			if (foundTracks.length) {
				try {
					await this.playlistsService.addTracks(playlist, foundTracks, user);
					this.logger.debug(
						`Added ${foundTracks.length} Tracks to Playlist "${playlist.uuid}"`,
					);
				} catch (e) {
					this.logger.error(
						`Failed to add Tracks to Playlist "${playlist.uuid}":`,
						e,
					);
				}
			}
		});

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

	@Get(":uuid/pending")
	@ApiOperation({ operationId: "getPlaylistUpdateProgress" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: [TrackCreationSessionResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async getPlaylistUpdateProgress(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<TrackCreationSessionResponse[]> {
		const playlist = await this.playlistsService.findByUuid(uuid);

		if (!playlist) {
			throw new NotFoundException("Playlist not found");
		}
		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		const sessions = this.ephemeralService.getCreationSessionsByPlaylistUuid(
			playlist.uuid,
		);

		return sessions.map((session) =>
			this.ephemeralService.toCreationSessionResponse(session),
		);
	}
}
