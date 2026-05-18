import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { LibrariesService } from "./libraries.service";
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { PluginLibrary } from "./response/loaded-library.response";
import { LibrarySearchDto } from "./dto/library-search.dto";
import { LibraryFindResponse } from "./response/library-find.response";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";

@Controller("libraries")
export class LibrariesController {
	constructor(
		private readonly librariesService: LibrariesService,
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	@Get()
	@ApiOperation({ operationId: "getAllLibraries" })
	@ApiOkResponse({
		type: [PluginLibrary],
	})
	all(): PluginLibrary[] {
		const pluginLibs = this.librariesService.allFlat();

		return pluginLibs.map(({ handler, plugin }) => ({
			pluginId: plugin.package.name,
			id: handler.id,
			name: handler.getName(),
		}));
	}

	@Get(":pluginId/:libraryId")
	@ApiOperation({ operationId: "getLibrary" })
	@ApiNotFoundResponse()
	@ApiOkResponse({
		type: PluginLibrary,
	})
	get(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
	): PluginLibrary {
		const library = this.librariesService.findLibrary(pluginId, libraryId);
		if (!library) {
			throw new NotFoundException("Library not found");
		}

		const { plugin, handler } = library;

		return {
			id: handler.id,
			name: handler.getName(),
			pluginId: plugin.package.name,
		};
	}

	@Post(":pluginId/:libraryId/search")
	@ApiOperation({ operationId: "searchLibrary" })
	@ApiNotFoundResponse()
	@ApiOkResponse({
		type: LibraryFindResponse,
	})
	async search(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Body() dto: LibrarySearchDto,
	): Promise<LibraryFindResponse> {
		const handler = this.librariesService.findLibrary(pluginId, libraryId);
		if (!handler) {
			throw new NotFoundException("Library not found");
		}

		const result = await this.librariesService.findTracks(handler, {
			amount: dto.pageSize,
			offset: dto.pageSize * (dto.page - 1),
			withAttributes: true,
			withArtists: true,
			withAlbums: true,
		});

		return {
			tracks: result.tracks.map((track) => track.toResponse()),
		};
	}
}
