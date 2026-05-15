import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsSearchDto } from "./dto/artists-search.dto";
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { ArtistsSearchResponse } from "./response/artists-search.response";
import { ArtistResponse } from "./response/artist.response";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";

@Controller("artists")
export class ArtistsController {
	constructor(
		private readonly artistsService: ArtistsService,
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	@Get(":artistUuid")
	@ApiOperation({ operationId: "getArtist" })
	@ApiOkResponse({
		type: ArtistResponse,
	})
	@ApiNotFoundResponse()
	async getArtist(@Param("artistUuid") artistUuid: string) {
		const artist = await this.artistsService.findOne(artistUuid, {
			withAttributes: true,
			withIdentities: true,
			withTracks: 10,
			withTrackArtists: true,
			withTrackAttributes: true,
			withAlbums: 10,
			withAlbumArtists: true,
			withAlbumAttributes: true,
		});
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}
		return artist.toResponse();
	}

	@ApiOperation({ operationId: "searchArtists" })
	@ApiOkResponse({
		type: ArtistsSearchResponse,
	})
	@Post()
	async search(@Body() dto: ArtistsSearchDto): Promise<ArtistsSearchResponse> {
		const artists = await this.artistsService.findMany({
			amount: dto.pageSize,
			offset: (dto.page - 1) * dto.pageSize,
			withAttributes: true,
			withIdentities: true,
		});

		return {
			artists: artists.map((artist) => artist.toResponse()),
		};
	}

	@Get(":artistUuid/urls")
	@ApiOperation({ operationId: "getArtistExternalUrls" })
	@ApiOkResponse({
		type: [ExternalUrlResponse],
	})
	@ApiNotFoundResponse()
	async getExternalUrls(
		@Param("artistUuid") artistUuid: string,
	): Promise<ExternalUrlResponse[]> {
		const artist = await this.artistsService.findOne(artistUuid);
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}
		return this.artistsService.getExternalUrls(artist);
	}
}
