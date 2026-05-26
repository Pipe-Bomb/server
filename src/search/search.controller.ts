import { Body, Controller, Post } from "@nestjs/common";
import { SearchService } from "./search.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { SearchDto } from "./dto/search.dto";
import { SearchResultsResponse } from "./response/search-results.response";

@Controller("search")
export class SearchController {
	constructor(private readonly searchService: SearchService) {}

	@Post()
	@ApiOperation({ operationId: "search" })
	@ApiOkResponse({
		type: SearchResultsResponse,
	})
	async search(@Body() dto: SearchDto): Promise<SearchResultsResponse> {
		const results = await this.searchService.search({
			trackAmount: dto.withTracks ? 30 : 0,
			artistAmount: dto.withArtists ? 10 : 0,
			albumAmount: dto.withAlbums ? 20 : 0,
			attributes: dto.attributes || [],
		});

		return {
			tracks: results.tracks.map((track) => track.toResponse()),
			artists: results.artists.map((artist) => artist.toResponse()),
			albums: results.albums.map((album) => album.toResponse()),
		};
	}
}
