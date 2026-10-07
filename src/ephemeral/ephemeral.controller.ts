import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	Res,
	StreamableFile,
} from "@nestjs/common";
import { EphemeralService } from "./ephemeral.service";
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
} from "@nestjs/swagger";
import { EphemeralSourceResponse } from "./response/ephemeral-source.response";
import { LoadedEphemeralSource } from "./interface/loaded-ephemeral-source.interface";
import { EphemeralSearchDto } from "./dto/ephemeral-search.dto";
import { EphemeralSearchResultsResponse } from "./response/ephemeral-search-results.response";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { BufferAttributeStreamService } from "src/attribute-sources/buffer-attribute-stream.service";
import { CreationSessionResponse } from "./response/creation-session.response";

@Controller("ephemeral")
export class EphemeralController {
	constructor(
		private readonly ephemeralService: EphemeralService,
		private readonly bufferAttributeStreamService: BufferAttributeStreamService,
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
		name: "plugin",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "source",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "entity",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "key",
		required: false,
		type: "string",
	})
	async getAttributeBuffer(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Param("file") file: string,
		@Query() queryParams: Record<string, string>,
		@Query("plugin") pluginId?: string,
		@Query("source") sourceId?: string,
		@Query("entity") entity?: string,
		@Query("key") key?: string,
	): Promise<StreamableFile | void> {
		const separatorIndex = file.indexOf(".");
		if (separatorIndex === -1) {
			throw new NotFoundException("Attribute not found");
		}
		const uuid = file.slice(0, separatorIndex);
		const extension = file.slice(separatorIndex + 1);

		const attribute = this.ephemeralService.getProxiedAttribute(uuid);

		if (!attribute) {
			throw new NotFoundException("Attribute not found");
		}

		const buffer = Buffer.isBuffer(attribute.buffer)
			? attribute.buffer
			: await attribute.buffer();

		return this.bufferAttributeStreamService.serve(
			req,
			res,
			{ uuid, extension, file },
			() => Readable.from([buffer]),
			queryParams,
			{ pluginId, sourceId, entity, key },
		);
	}

	@Get("creation-session/:uuid")
	@ApiOkResponse({
		type: CreationSessionResponse,
	})
	@ApiNotFoundResponse()
	getCreationSession(@Param("uuid") uuid: string): CreationSessionResponse {
		const session = this.ephemeralService.getCreationSession(uuid);
		if (!session) {
			throw new NotFoundException();
		}
		return this.ephemeralService.toCreationSessionResponse(session);
	}
}
