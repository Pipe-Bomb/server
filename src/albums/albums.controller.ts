import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsSearchDto } from "./dto/albums-search.dto";
import {
	ApiOperation,
	ApiOkResponse,
	ApiNotFoundResponse,
	ApiBadRequestResponse,
} from "@nestjs/swagger";
import { AlbumsSearchResponse } from "./response/albums-search.response";
import { AlbumResponse } from "./response/album.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralSourceResponse } from "src/ephemeral/response/ephemeral-source.response";
import { AlbumEphemeralContentResponse } from "./response/album-ephemeral-content.response";
import { EphemeralSourceDto } from "src/ephemeral/dto/ephemeral-source.dto";

@Controller("albums")
export class AlbumsController {
	constructor(
		private readonly albumsService: AlbumsService,
		private readonly albumManagerService: AlbumManagerService,
		private readonly ephemeralService: EphemeralService,
	) {}

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
			throw new NotFoundException("Souce does not exist");
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
		const albums = await this.albumManagerService.findMany({
			amount: dto.pageSize,
			offset: (dto.page - 1) * dto.pageSize,
			withAttributes: true,
			withIdentities: true,
			withArtists: true,
		});

		return {
			albums: albums.map((album) => album.toResponse()),
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
}
