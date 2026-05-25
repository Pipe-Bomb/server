import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	Query,
	StreamableFile,
} from "@nestjs/common";
import { EphemeralService } from "./ephemeral.service";
import { ApiOkResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { EphemeralSourceResponse } from "./response/ephemeral-source.response";
import { LoadedEphemeralSource } from "./interface/loaded-ephemeral-source.interface";
import { EphemeralSearchDto } from "./dto/ephemeral-search.dto";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { EphemeralSearchResultsResponse } from "./response/ephemeral-search-results.response";
import Mime from "mime";
import path from "path";
import { ResourcesService } from "src/resources/resources.service";

@Controller("ephemeral")
export class EphemeralController {
	constructor(
		private readonly ephemeralService: EphemeralService,
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly resourcesService: ResourcesService,
	) {}

	@Get()
	@ApiOperation({ operationId: "getAllEphemeralSources" })
	@ApiOkResponse({
		type: [EphemeralSourceResponse],
	})
	getAll(): EphemeralSourceResponse[] {
		return this.ephemeralService
			.allFlat()
			.map((source) => this.toResponse(source));
	}

	toResponse(source: LoadedEphemeralSource): EphemeralSourceResponse {
		return {
			id: source.source.id,
			pluginId: source.plugin.package.name,
			name: source.source.getName(),
		};
	}

	@Post("search")
	@ApiOperation({
		operationId: "searchEphemeralSource",
	})
	@ApiOkResponse({
		type: EphemeralSearchResultsResponse,
	})
	async search(
		@Body() dto: EphemeralSearchDto,
	): Promise<EphemeralSearchResultsResponse> {
		const source = this.ephemeralService.find(dto.pluginId, dto.sourceId);

		if (!source) {
			throw new NotFoundException("Ephemeral Source not found");
		}

		const results = await this.ephemeralService.search(source, {
			query: dto.query,
		});

		const tracks = await this.ephemeralService.toTracksResponse(
			results.tracks,
			source,
			results.attributeSource,
		);

		const artists = await this.ephemeralService.toArtistsResponse(
			results.artists,
			results.attributeSource,
		);

		const albums = await this.ephemeralService.toAlbumsResponse(
			results.albums,
			results.attributeSource,
		);

		return {
			tracks,
			artists,
			albums,
		};
	}

	@Get("attribute-buffer/:file")
	@ApiQuery({
		name: "width",
		required: false,
		type: "integer",
	})
	@ApiQuery({
		name: "height",
		required: false,
		type: "integer",
	})
	async getAttributeBuffer(
		@Param("file") file: string,
		@Query("width") widthStr?: string,
		@Query("height") heightStr?: string,
	) {
		const extension = path.extname(file);
		const uuid = path.basename(file, extension);

		const attribute = this.ephemeralService.getProxiedAttribute(uuid);

		if (!attribute) {
			throw new NotFoundException("Attribute not found");
		}

		const mimeType = Mime.getType(attribute.extension);
		let buffer: Buffer;
		if (Buffer.isBuffer(attribute.buffer)) {
			buffer = attribute.buffer;
		} else {
			buffer = await attribute.buffer();
		}

		if (!mimeType) {
			throw new BadRequestException();
		}

		const width = this.resourcesService.sanitizeDimension(widthStr);
		const height = this.resourcesService.sanitizeDimension(heightStr);

		if (width || height) {
			const resized = await this.resourcesService.resizeImage(buffer, {
				width,
				height,
			});
			return new StreamableFile(resized, {
				type: "image/webp",
			});
		}

		return new StreamableFile(buffer, {
			type: mimeType,
		});
	}
}
