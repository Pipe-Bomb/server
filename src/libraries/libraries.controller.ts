import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Logger,
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
import { SearchSourceService } from "src/search/search-source.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { In } from "typeorm";

@Controller("libraries")
export class LibrariesController {
	private readonly logger = new Logger("Libraries Controller");

	constructor(
		private readonly librariesService: LibrariesService,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly searchSourceService: SearchSourceService,
		private readonly trackManagerService: TrackManagerService,
	) {}

	@Get()
	@ApiOperation({ operationId: "getAllLibraries" })
	@ApiOkResponse({
		type: [PluginLibrary],
	})
	all(): PluginLibrary[] {
		const pluginLibs = this.librariesService.allFlat();

		return pluginLibs.map(({ handler, plugin }) => {
			try {
				return {
					pluginId: plugin.package.name,
					id: handler.id,
					name: handler.getName(),
				};
			} catch (e) {
				this.logger.error(
					`Library Handler "${handler.id}" from Plugin "${plugin.package.name}" threw during getName():`,
					e,
				);
				throw new InternalServerErrorException("Failed to get library name");
			}
		});
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

		try {
			return {
				id: handler.id,
				name: handler.getName(),
				pluginId: plugin.package.name,
			};
		} catch (e) {
			this.logger.error(
				`Library Handler "${handler.id}" from Plugin "${plugin.package.name}" threw during getName():`,
				e,
			);
			throw new InternalServerErrorException("Failed to get library name");
		}
	}

	@Post(":pluginId/:libraryId/search")
	@ApiOperation({ operationId: "searchLibrary" })
	@ApiNotFoundResponse()
	@ApiOkResponse({
		type: LibraryFindResponse,
	})
	@HttpCode(HttpStatus.OK)
	async search(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Body() dto: LibrarySearchDto,
	): Promise<LibraryFindResponse> {
		const handler = this.librariesService.findLibrary(pluginId, libraryId);
		if (!handler) {
			throw new NotFoundException("Library not found");
		}

		if (this.searchSourceService.hasSource()) {
			const allowedUuids = await this.librariesService.getTrackUuids(handler);

			const raw = await this.searchSourceService.search({
				sort: dto.sort,
				entities: {
					tracks: {
						limit: dto.pageSize,
						page: dto.page,
						allowedUuids,
					},
				},
			});

			const orderedUuids = raw.tracks ?? [];
			const fetched = orderedUuids.length
				? await this.trackManagerService.find({
						where: { uuid: In(orderedUuids) },
						relationLoadStrategy: "query",
						relations: {
							attributes: true,
							artists: { artist: { attributes: true } },
							albums: { album: { attributes: true } },
						},
					})
				: [];

			const trackByUuid = new Map(fetched.map((t) => [t.uuid, t]));
			const tracks = orderedUuids
				.map((uuid) => trackByUuid.get(uuid))
				.filter((t): t is (typeof fetched)[number] => t !== undefined);

			const totalPages =
				raw.trackTotal !== undefined
					? Math.ceil(raw.trackTotal / dto.pageSize)
					: undefined;

			return { tracks: tracks.map((t) => t.toResponse()), totalPages };
		}

		const result = await this.librariesService.findTracks(handler, {
			amount: dto.pageSize,
			offset: dto.pageSize * (dto.page - 1),
			withAttributes: true,
			withArtists: true,
			withAlbums: true,
			sort: dto.sort,
		});

		return {
			tracks: result.tracks.map((track) => track.toResponse()),
		};
	}
}
