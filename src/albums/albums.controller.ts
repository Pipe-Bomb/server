import {
	Body,
	Controller,
	Get,
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
} from "@nestjs/swagger";
import { AlbumsSearchResponse } from "./response/albums-search.response";
import { AlbumResponse } from "./response/album.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

@Controller("albums")
export class AlbumsController {
	constructor(
		private readonly albumsService: AlbumsService,
		private readonly albumManagerService: AlbumManagerService,
	) {}

	@Get(":albumUuid")
	@ApiOperation({ operationId: "getAlbum" })
	@ApiOkResponse({
		type: AlbumResponse,
	})
	@ApiNotFoundResponse()
	async getAlbum(@Param("albumUuid") albumUuid: string) {
		console.log("Getting album:", albumUuid);
		const album = await this.albumManagerService.findOne(albumUuid, {
			withArtists: true,
			withAttributes: true,
			withIdentities: true,
			withTracks: true,
			withTrackArtists: true,
			withTrackAttributes: true,
		});
		console.log("Received album response:", album);

		if (!album) {
			throw new NotFoundException("Album not found");
		}
		return album.toResponse();
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
		return this.albumsService.getExternalUrls(album);
	}
}
