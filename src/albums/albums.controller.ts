import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsSearchDto } from "./dto/albums-search.dto";
import {
	ApiOperation,
	ApiOkResponse,
	ApiNotFoundResponse,
	ApiBadRequestResponse,
	ApiNoContentResponse,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AlbumsSearchResponse } from "./response/albums-search.response";
import { AlbumResponse } from "./response/album.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralSourceResponse } from "src/ephemeral/response/ephemeral-source.response";
import { AlbumEphemeralContentResponse } from "./response/album-ephemeral-content.response";
import { EphemeralSourceDto } from "src/ephemeral/dto/ephemeral-source.dto";
import { SearchSourcesService } from "src/search/search-sources.service";
import { In } from "typeorm";
import { SavedAlbumsService } from "./saved-albums.service";
import { ReqUser } from "src/users/user.decorator";
import { FetchUserPipe } from "src/users/user.pipe";
import { DBUser } from "src/users/entity/user.entity";
import { CreationSessionResponse } from "src/ephemeral/response/creation-session.response";
import { SavedAlbumsResponse } from "./response/saved-albums.response";

@Controller("albums")
export class AlbumsController {
	constructor(
		private readonly albumsService: AlbumsService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly ephemeralService: EphemeralService,
		private readonly SearchSourcesService: SearchSourcesService,
		private readonly savedAlbumsService: SavedAlbumsService,
	) {}

	@Get("saved")
	@ApiOperation({ operationId: "getSavedAlbums" })
	@ApiOkResponse({
		type: SavedAlbumsResponse,
	})
	@ApiUnauthorizedResponse()
	async getSavedAlbums(
		@Query("pageSize") pageSize?: string,
		@Query("page") page?: string,
		@ReqUser(FetchUserPipe) user?: DBUser,
	): Promise<SavedAlbumsResponse> {
		const size = Math.min(
			Math.max(parseInt(pageSize ?? "20", 10) || 20, 1),
			30,
		);
		const pageNum = Math.max(parseInt(page ?? "1", 10) || 1, 1);
		const { albums, total } = await this.savedAlbumsService.getSavedAlbums(
			user ?? null,
			{
				amount: size,
				offset: (pageNum - 1) * size,
				withAlbums: true,
				withAttributes: true,
				withIdentities: true,
				withArtists: true,
			},
		);

		return {
			albums: albums
				.filter((entry) => entry.album)
				.map((entry) => entry.album!.toResponse()),
			total,
		};
	}

	@Get("saved/pending")
	@ApiOperation({ operationId: "getSavedAlbumsPending" })
	@ApiOkResponse({
		type: CreationSessionResponse,
		isArray: true,
	})
	@ApiUnauthorizedResponse()
	async getSavedAlbumsPending(@ReqUser(FetchUserPipe) user?: DBUser) {
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

	@Get(":albumUuid")
	@ApiOperation({ operationId: "getAlbum" })
	@ApiOkResponse({
		type: AlbumResponse,
	})
	@ApiNotFoundResponse()
	async getAlbum(@Param("albumUuid") albumUuid: string) {
		const album = await this.albumManagerService.findOne(albumUuid, {
			withArtists: true,
			withArtistAttributes: true,
			withAttributes: true,
			withIdentities: true,
			withTracks: true,
			withTrackArtists: true,
			withTrackArtistAttributes: true,
			withTrackAttributes: true,
		});

		if (!album) {
			throw new NotFoundException("Album not found");
		}
		return album.toResponse();
	}

	@Get(":pluginId/:identifierId/:identity")
	@ApiOperation({ operationId: "getAlbumByIdentity" })
	@ApiOkResponse({
		type: AlbumResponse,
	})
	@ApiNotFoundResponse()
	async getAlbumByIdentity(
		@Param("pluginId") pluginId: string,
		@Param("identifierId") identifierId: string,
		@Param("identity") identity: string,
	): Promise<AlbumResponse> {
		const albumUuid = await this.albumManagerService.resolveAlbum(
			pluginId,
			identifierId,
			identity,
		);
		if (albumUuid) {
			return this.getAlbum(albumUuid);
		}

		const album = await this.ephemeralService.resolveEphemeralAlbum(
			pluginId,
			identifierId,
			identity,
		);
		if (!album) {
			throw new NotFoundException("Album not found");
		}

		return album;
	}

	@Get(":albumUuid/ephemeral")
	@ApiOperation({ operationId: "getAlbumEphemeralSources" })
	@ApiOkResponse({
		type: EphemeralSourceResponse,
		isArray: true,
	})
	@ApiNotFoundResponse()
	async getAlbumEphemeralSources(
		@Param("albumUuid") albumUuid: string,
	): Promise<EphemeralSourceResponse[]> {
		const album = await this.albumManagerService.findOne(albumUuid, {
			withIdentities: true,
		});

		if (!album) {
			throw new NotFoundException("Album not found");
		}

		const sources = this.ephemeralService.getEphemeralAlbumSources(
			album.identities!,
		);

		return sources.map(({ source, plugin }) => ({
			id: source.id,
			pluginId: plugin.package.name,
			name: source.getName(),
		}));
	}

	@Post(":albumUuid/ephemeral")
	@ApiOperation({ operationId: "getAlbumEphemeralContent" })
	@ApiOkResponse({
		type: AlbumEphemeralContentResponse,
	})
	@ApiNotFoundResponse()
	@ApiBadRequestResponse()
	@HttpCode(HttpStatus.OK)
	async getAlbumEphemeralContent(
		@Param("albumUuid") albumUuid: string,
		@Body() dto: EphemeralSourceDto,
	): Promise<AlbumEphemeralContentResponse> {
		const source = this.ephemeralService.find(dto.pluginId, dto.sourceId);
		if (!source) {
			throw new NotFoundException("Souce does not exist");
		}

		const identities = await this.albumManagerService.findIdentities(albumUuid);

		const identifiers = this.ephemeralService.getAlbumIdentifiers(source);

		const matchingIdentities = identities.filter(
			(identity) =>
				identity.pluginId == source.plugin.package.name &&
				identifiers.includes(identity.identifierId),
		);

		if (!matchingIdentities.length) {
			throw new BadRequestException("Album is not handled by Source");
		}

		// todo: handle multiple identities
		const identity = matchingIdentities[0];
		const content = await this.ephemeralService.getEphemeralAlbumContent(
			source,
			identity.identifierId,
			identity.identity,
		);

		if (!content) {
			throw new BadRequestException("Album is not handled by Source");
		}

		return {
			source: {
				id: content.source.source.id,
				pluginId: content.source.plugin.package.name,
				name: content.source.source.getName(),
			},
			tracks: content.tracks ?? [],
		};
	}

	@Post(":pluginId/:identifierId/:identity")
	@ApiOperation({ operationId: "getAlbumEphemeralContentByIdentity" })
	@ApiOkResponse({
		type: AlbumEphemeralContentResponse,
	})
	@ApiBadRequestResponse()
	@HttpCode(HttpStatus.OK)
	async getAlbumEphemeralContentByIdentity(
		@Param("pluginId") pluginId: string,
		@Param("identifierId") identifierId: string,
		@Param("identity") identity: string,
	): Promise<AlbumEphemeralContentResponse> {
		const source = this.ephemeralService.getEphemeralSourceByAlbumIdentity(
			pluginId,
			identifierId,
		);

		if (!source) {
			throw new NotFoundException("Source does not exist");
		}

		const content = await this.ephemeralService.getEphemeralAlbumContent(
			source,
			identifierId,
			identity,
		);

		if (!content) {
			throw new BadRequestException("Album is not handled by Source");
		}

		return {
			source: {
				id: content.source.source.id,
				pluginId: content.source.plugin.package.name,
				name: content.source.source.getName(),
			},
			tracks: content.tracks ?? [],
		};
	}

	@ApiOperation({ operationId: "searchAlbums" })
	@ApiOkResponse({
		type: AlbumsSearchResponse,
	})
	@Post()
	async search(@Body() dto: AlbumsSearchDto): Promise<AlbumsSearchResponse> {
		if (this.SearchSourcesService.hasSource()) {
			const raw = await this.SearchSourcesService.search({
				sort: dto.sort,
				entities: { albums: { limit: dto.pageSize, page: dto.page } },
			});

			const orderedUuids = raw.albums ?? [];
			const fetched = orderedUuids.length
				? await this.albumManagerService.findMany({
						where: { uuid: In(orderedUuids) },
						withArtists: true,
						withAttributes: true,
						withIdentities: true,
						amount: orderedUuids.length,
					})
				: [];

			const albumByUuid = new Map(fetched.map((a) => [a.uuid, a]));
			const albums = orderedUuids
				.map((uuid) => albumByUuid.get(uuid))
				.filter((a): a is (typeof fetched)[number] => a !== undefined);

			const totalPages =
				raw.albumTotal !== undefined
					? Math.ceil(raw.albumTotal / dto.pageSize)
					: null;

			return { albums: albums.map((album) => album.toResponse()), totalPages };
		}

		const albums = await this.albumManagerService.findMany({
			amount: dto.pageSize,
			offset: (dto.page - 1) * dto.pageSize,
			withAttributes: true,
			withIdentities: true,
			withArtists: true,
		});

		return {
			albums: albums.map((album) => album.toResponse()),
			totalPages: null,
		};
	}

	@Get(":albumUuid/urls")
	@ApiOperation({ operationId: "getAlbumExternalUrls" })
	@ApiOkResponse({
		type: [ExternalUrlResponse],
	})
	@ApiNotFoundResponse()
	async getExternalUrls(
		@Param("albumUuid") albumUuid: string,
	): Promise<ExternalUrlResponse[]> {
		const album = await this.albumManagerService.findOne(albumUuid);
		if (!album) {
			throw new NotFoundException("Album not found");
		}
		return this.albumManagerService.getExternalUrls(album);
	}

	@Put(":albumUuid/save")
	@ApiOperation({ operationId: "saveAlbum" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async saveAlbum(
		@Param("albumUuid") albumUuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const album = await this.albumManagerService.findOne(albumUuid);
		if (!album) {
			throw new NotFoundException("Album not found");
		}

		await this.savedAlbumsService.saveAlbum(album, user);
	}

	@Delete(":albumUuid/save")
	@ApiOperation({ operationId: "unsaveAlbum" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async unsaveAlbum(
		@Param("albumUuid") albumUuid: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		const album = await this.albumManagerService.findOne(albumUuid);
		if (!album) {
			throw new NotFoundException("Album not found");
		}

		await this.savedAlbumsService.unsaveAlbum(album, user);
	}

	@Put(":pluginId/:identifierId/:identity/save")
	@ApiOperation({ operationId: "saveEphemeralAlbum" })
	@ApiOkResponse({
		type: CreationSessionResponse,
	})
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async saveEphemeralAlbum(
		@Param("pluginId") pluginId: string,
		@Param("identifierId") identifierId: string,
		@Param("identity") identity: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<CreationSessionResponse | void> {
		const albumUuid = await this.albumManagerService.resolveAlbum(
			pluginId,
			identifierId,
			identity,
		);
		if (albumUuid) {
			await this.saveAlbum(albumUuid, user);
			return;
		}

		const session = await this.savedAlbumsService.saveEphemeralAlbum(
			pluginId,
			identifierId,
			identity,
			user,
		);
		return this.ephemeralService.toCreationSessionResponse(session);
	}
}
