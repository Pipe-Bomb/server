import {
	BadRequestException,
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
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
	ApiQuery,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { DBTrack } from "src/tracks/entities/track.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { LibrariesService } from "src/libraries/libraries.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { TrackCreationSessionResponse } from "src/ephemeral/response/track-creation-session.response";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { PlaylistTracksQuery } from "./dto/playlist-tracks-query.dto";
import { PlaylistTrackResponse } from "./response/playlist-track.response";
import { TrackIdDto } from "src/tracks/dto/track-id.dto";
import { CreateSmartFilterGroupDto } from "./dto/create-smart-filter-group.dto";
import { SmartPlaylistsService } from "./smart-playlists.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { UpdatePlaylistTracksDto } from "./dto/update-playlist-tracks.dto";
import { UpdatePlaylistAttributesDto } from "./dto/update-playlist-attributes.dto";
import { AttributeUploadSessionResponse } from "src/attributes/response/attribute-upload-session.response";
import { PlaylistVisibilityDto } from "./dto/playlist-visibility.dto";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { OptionalAuth } from "src/users/optional-auth.decorator";

@Controller("playlists")
export class PlaylistsController {
	private readonly logger = new Logger("Playlists Controller");

	constructor(
		private readonly playlistsService: PlaylistsService,
		private readonly smartPlaylistsService: SmartPlaylistsService,
		private readonly attributeUploadService: AttributeUploadService,
		private readonly trackManagerService: TrackManagerService,
		private readonly librariesService: LibrariesService,
		private readonly ephemeralService: EphemeralService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly attributeSourcesService: AttributeSourcesService,
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
		const attributes = this.attributeSourcesService.customToAttributeValues(
			dto.attributes,
		);

		const playlist = await this.playlistsService.create(user, attributes);
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
	@OptionalAuth()
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiQuery({
		name: "tracks",
		required: false,
		type: Number,
		minimum: 0,
		maximum: 200,
		description: "Maximum number of tracks to include",
	})
	async getPlaylist(
		@Param("uuid") uuid: string,
		@Query("tracks", new DefaultValuePipe(0), ParseIntPipe)
		tracks: number,
		@ReqUser(FetchUserPipe) user?: DBUser,
	): Promise<PlaylistResponse> {
		if (tracks < 0 || tracks > 200) {
			throw new BadRequestException("limit must be between 0 and 200");
		}

		const playlistInfo = await this.playlistsService.findByUuid(uuid, {
			withAttributes: true,
			withTracks: tracks,
			withTrackArtists: true,
			withTrackAttributes: true,
			withTrackUsers: true,
			withTrackAlbums: true,
			withOwner: true,
			withSmartFilters: true,
		});
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist, trackCount } = playlistInfo;

		if (playlist.visibility == PlaylistVisibility.PRIVATE) {
			if (!user || playlist.ownerUuid != user.uuid) {
				throw new ForbiddenException();
			}
		}

		return playlist.toResponse(trackCount);
	}

	@Get(":uuid/all")
	@ApiOperation({ operationId: "getAllPlaylistTrackIds" })
	@OptionalAuth()
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: [PlaylistTrackResponse],
	})
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	@ApiUnauthorizedResponse()
	async getAllPlaylistTrackIds(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user?: DBUser,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.visibility == PlaylistVisibility.PRIVATE) {
			if (!user || playlist.ownerUuid != user.uuid) {
				throw new ForbiddenException();
			}
		}

		const tracks = await this.playlistsService.findAllTracks(playlist);
		return tracks.map((track) => track.toResponse());
	}

	@Post(":uuid")
	@ApiOperation({ operationId: "getPlaylistTracks" })
	@OptionalAuth()
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: [PlaylistTrackResponse],
	})
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	@ApiUnauthorizedResponse()
	@HttpCode(HttpStatus.OK)
	async getPlaylistTracks(
		@Param("uuid") uuid: string,
		@Body() dto: PlaylistTracksQuery,
		@ReqUser(FetchUserPipe) user?: DBUser,
	): Promise<PlaylistTrackResponse[]> {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.visibility == PlaylistVisibility.PRIVATE) {
			if (!user || playlist.ownerUuid != user.uuid) {
				throw new ForbiddenException();
			}
		}

		const tracks = await this.playlistsService.findTracks(playlist, {
			offset: dto.offset,
			amount: dto.amount,
			withTrackArtists: true,
			withTrackAttributes: true,
			withTrackUsers: true,
			withTrackAlbums: true,
		});

		return tracks.map((track) => track.toResponse()).filter((track) => !!track);
	}

	@Patch(":uuid/tracks")
	@ApiOperation({ operationId: "updatePlaylistTracks" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async updatePlaylistTracks(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
		@Body() dto: UpdatePlaylistTracksDto,
	): Promise<PlaylistResponse> {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		if (dto.add) {
			const tracks: (DBTrack | null)[] = [];
			const missingTracks: (TrackIdDto & { index: number })[] = [];

			const resolveTracks = async (toLookup: TrackIdDto[]) => {
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

			if (dto.add.tracks?.length) {
				await resolveTracks(dto.add.tracks);
			}

			if (dto.add.albums?.length) {
				for (const albumInfo of dto.add.albums) {
					if (albumInfo.uuid) {
						const album = await this.albumManagerService.findOne(
							albumInfo.uuid,
							{
								withTracks: true,
							},
						);
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
		}

		if (dto.remove?.length) {
			const tracks = (
				await this.librariesService.resolveTracks(dto.remove)
			).filter((track) => !!track);

			await this.playlistsService.removeTracks(playlist, tracks);
		}

		return this.getPlaylist(playlist.uuid, 50, user);
	}

	@Patch(":uuid/attributes")
	@ApiOperation({ operationId: "updatePlaylistAttributes" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: [AttributeUploadSessionResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async updatePlaylistAttributes(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
		@Body() dto: UpdatePlaylistAttributesDto,
	): Promise<AttributeUploadSessionResponse[]> {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		const attributes = this.attributeSourcesService.customToAttributeValues(
			dto.attributes,
		);

		return await this.playlistsService.updateAttributes(
			playlist,
			attributes,
			null,
			user,
		);
	}

	@Patch(":uuid/visibility")
	@ApiOperation({ operationId: "updatePlaylistVisibility" })
	@UseGuards(AuthGuard)
	@ApiOkResponse({
		type: PlaylistResponse,
	})
	async updatePlaylistVisibility(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
		@Body() dto: PlaylistVisibilityDto,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		await this.playlistsService.setVisibility(playlist.uuid, dto.visibility);
		return this.getPlaylist(playlist.uuid, 50, user);
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
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		await this.playlistsService.delete(playlist);
	}

	@Get(":uuid/pending")
	@ApiOperation({ operationId: "getPlaylistUpdateProgress" })
	@OptionalAuth()
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
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.visibility == PlaylistVisibility.PRIVATE) {
			if (!user || playlist.ownerUuid != user.uuid) {
				throw new ForbiddenException();
			}
		}

		const sessions = this.ephemeralService.getCreationSessionsByPlaylistUuid(
			playlist.uuid,
		);

		return sessions.map((session) =>
			this.ephemeralService.toCreationSessionResponse(session),
		);
	}

	@Put(":uuid/filters")
	@ApiOperation({ operationId: "addPlaylistSmartFilterGroup" })
	@UseGuards(AuthGuard)
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async addPlaylistSmartFilterGroup(
		@Param("uuid") uuid: string,
		@Body() dto: CreateSmartFilterGroupDto,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(uuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		if (!dto.filters.length) {
			throw new BadRequestException("No filters in group");
		}

		await this.smartPlaylistsService.addFilterGroup(playlist, dto.filters);
	}

	@Patch(":playlistUuid/filters/:filterGroupUuid")
	@ApiOperation({ operationId: "updatePlaylistSmartFilterGroup" })
	@UseGuards(AuthGuard)
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async updatePlaylistSmartFilterGroup(
		@Param("playlistUuid") playlistUuid: string,
		@Param("filterGroupUuid") filterGroupUuid: string,
		@Body() dto: CreateSmartFilterGroupDto,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(playlistUuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		if (!dto.filters.length) {
			throw new BadRequestException("No filters in group");
		}

		await this.smartPlaylistsService.updateFilterGroup(
			filterGroupUuid,
			playlist.uuid,
			dto.filters,
		);
	}

	@Delete(":playlistUuid/filters/:filterGroupUuid")
	@ApiOperation({ operationId: "deletePlaylistSmartFilterGroup" })
	@UseGuards(AuthGuard)
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async deletePlaylistSmartFilterGroup(
		@Param("playlistUuid") playlistUuid: string,
		@Param("filterGroupUuid") filterGroupUuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(playlistUuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		await this.smartPlaylistsService.deleteFilterGroup(
			filterGroupUuid,
			playlist.uuid,
		);
	}

	@Post(":uuid/filters")
	@ApiOperation({ operationId: "runPlaylistSmartFilters" })
	@UseGuards(AuthGuard)
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	async runPlaylistSmartFilters(
		@Param("uuid") playlistUuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const playlistInfo = await this.playlistsService.findByUuid(playlistUuid);
		if (!playlistInfo) {
			throw new NotFoundException("Playlist not found");
		}
		const { playlist } = playlistInfo;

		if (playlist.ownerUuid != user.uuid) {
			throw new ForbiddenException();
		}

		await this.smartPlaylistsService.runFilters(playlist.uuid);
	}
}
