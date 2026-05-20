import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	Res,
	StreamableFile,
} from "@nestjs/common";
import { EphemeralService } from "./ephemeral.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { EphemeralSourceResponse } from "./response/ephemeral-source.response";
import { LoadedEphemeralSource } from "./interface/loaded-ephemeral-source.interface";
import { EphemeralSearchDto } from "./dto/ephemeral-search.dto";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { EphemeralSearchResultsResponse } from "./response/ephemeral-search-results.response";
import { EphemeralTrack } from "@sdk";
import { EphemeralTrackResponse } from "./response/ephemeral-track.response";
import { PersistentAttributeResponse } from "src/attributes/response/persistent-attribute.response";
import Mime from "mime";
import type { Response } from "express";
import path from "path";

@Controller("ephemeral")
export class EphemeralController {
	constructor(
		private readonly ephemeralService: EphemeralService,
		private readonly attributeSourcesService: AttributeSourcesService,
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

		if (!results.attributeSource) {
			return {
				tracks: results.tracks.map((track) =>
					this.toTrackResponse(track, source, null),
				),
			};
		}

		const attributeSource = results.attributeSource;
		const possibleAttributes = this.attributeSourcesService
			.getTrackAttributes()
			.filter(
				(attribute) =>
					attribute.source.plugin.package.name ==
						attributeSource.plugin.package.name &&
					attribute.source.source.id == attributeSource.source.id,
			);

		const tracks = results.tracks.map((track) => {
			const attributes = this.ephemeralService.createEphemeralAttributes(
				track.attributes ?? [],
				attributeSource,
				possibleAttributes,
			);

			return this.toTrackResponse(track, source, attributes);
		});

		return {
			tracks,
		};
	}

	@Get("attribute-buffer/:file")
	async getAttributeBuffer(@Param("file") file: string) {
		const extension = path.extname(file);
		const uuid = path.basename(file, extension);

		const attribute = this.ephemeralService.getProxiedAttribute(uuid);

		if (!attribute) {
			throw new NotFoundException("Attribute not found");
		}

		const mimeType = Mime.getType(attribute.extension);
		const buffer = await attribute.fetch();

		if (mimeType) {
			return new StreamableFile(buffer, {
				type: mimeType,
			});
		}

		throw new BadRequestException();
	}

	toTrackResponse(
		track: EphemeralTrack,
		source: LoadedEphemeralSource,
		attributes: Record<string, PersistentAttributeResponse> | null,
	): EphemeralTrackResponse {
		return {
			id: track.id,
			title: track.title,
			pluginId: source.plugin.package.name,
			libraryId: source.source.getLibraryHandler().id,
			attributes,
		};
	}
}
