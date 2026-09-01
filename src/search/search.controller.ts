import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import { SearchService } from "./search.service";
import { ApiOkResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { SearchDto } from "./dto/search.dto";
import { SearchResultsResponse } from "./response/search-results.response";
import { SearchSourceService } from "./search-source.service";
import {
	FilterableAttributeResponse,
	SearchSourceResponse,
	SearchSourceSummaryResponse,
	SortMethodResponse,
} from "./response/search-source.response";
import { SearchSourceDto } from "./dto/search-source.dto";

@Controller("search")
export class SearchController {
	constructor(
		private readonly searchService: SearchService,
		private readonly searchSourceService: SearchSourceService,
	) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ operationId: "search" })
	@ApiOkResponse({
		type: SearchResultsResponse,
	})
	async search(@Body() dto: SearchDto): Promise<SearchResultsResponse> {
		const results = await this.searchService.search({
			query: dto.query,
			sort: dto.sort,
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

	@Get("sources")
	@ApiOperation({ operationId: "getSearchSources" })
	@ApiOkResponse({ type: [SearchSourceSummaryResponse] })
	getSearchSources(): SearchSourceSummaryResponse[] {
		return this.searchSourceService.getAll();
	}

	@Put("source")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ operationId: "setActiveSearchSource" })
	@ApiOkResponse()
	async setActiveSearchSource(@Body() dto: SearchSourceDto): Promise<void> {
		console.log("Setting", dto);
		await this.searchSourceService.setActive(dto.pluginId, dto.sourceId);
	}

	@Delete("source")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ operationId: "clearActiveSearchSource" })
	@ApiOkResponse()
	async clearActiveSearchSource(): Promise<void> {
		console.log("Clearing");
		await this.searchSourceService.clearActive();
	}

	@Get("source")
	@ApiOperation({ operationId: "getSearchSource" })
	@ApiOkResponse({ type: SearchSourceResponse })
	@ApiQuery({ name: "tracks", required: false, type: Boolean })
	@ApiQuery({ name: "albums", required: false, type: Boolean })
	@ApiQuery({ name: "artists", required: false, type: Boolean })
	getSearchSource(
		@Query("tracks") tracks?: string,
		@Query("albums") albums?: string,
		@Query("artists") artists?: string,
	): SearchSourceResponse | null {
		const loaded = this.searchSourceService.getLoaded();
		if (!loaded) {
			return null;
		}

		const hasEntityParams =
			tracks !== undefined || albums !== undefined || artists !== undefined;
		const entities = hasEntityParams
			? {
					tracks: tracks === "true",
					albums: albums === "true",
					artists: artists === "true",
				}
			: { tracks: true, albums: true, artists: true };

		const caps = loaded.source.getCapabilities(entities);

		const sortMethods: SortMethodResponse[] | null =
			caps.sortMethods?.map((m) => ({
				key: m.key,
				label: m.label ?? null,
				ascending: m.ascending,
				descending: m.descending,
			})) ?? null;

		const filterableAttributes: FilterableAttributeResponse[] | null =
			caps.filterableAttributes?.map((a) => ({
				entityType: a.entityType,
				attributeKey: a.attributeKey,
				attributeType: a.attributeType,
				label: a.label ?? null,
				supportsFuzzy:
					a.attributeType === "string"
						? (a as { supportsFuzzy: boolean }).supportsFuzzy
						: null,
			})) ?? null;

		return {
			pluginId: loaded.plugin.package.name,
			sourceId: loaded.source.id,
			name: loaded.source.getName(),
			sortMethods,
			filterableAttributes,
		};
	}
}
