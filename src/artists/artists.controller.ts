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

@Controller("artists")
export class ArtistsController {
	constructor(private readonly artistsService: ArtistsService) {}

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
			withTracks: true,
			withTrackArtists: true,
			withTrackAttributes: true,
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
}
