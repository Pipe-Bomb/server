import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
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
import path from "path";
import { TrackArtistResponse } from "src/tracks/response/track-artist.response";

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
					this.toTrackResponse(track, source, null, null),
				),
			};
		}

		const trackArtists = results.tracks.flatMap((track) => track.artists ?? []);
		const allArtistUuids =
			await this.ephemeralService.resolveArtists(trackArtists);

		const attributeSource = results.attributeSource;
		const possibleTrackAttributes = this.attributeSourcesService
			.getTrackAttributes()
			.filter(
				(attribute) =>
					attribute.source.plugin.package.name ==
						attributeSource.plugin.package.name &&
					attribute.source.source.id == attributeSource.source.id,
			);

		const possibleArtistAttributes = this.attributeSourcesService
			.getArtistAttributes()
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
				possibleTrackAttributes,
			);

			const artists = (track.artists ?? []).map((trackArtist) => {
				const index = trackArtists.indexOf(trackArtist);
				const artistUuid = allArtistUuids[index]!;

				const artist: TrackArtistResponse = {
					artistUuid,
					joinPhrase: trackArtist.joinPhrase ?? null,
					artist: {
						uuid: artistUuid,
						attributes: this.ephemeralService.createEphemeralAttributes(
							trackArtist.attributes,
							attributeSource,
							possibleArtistAttributes,
						),
						albums: null,
						identities: null,
						tracks: null,
					},
				};

				return artist;
			});

			console.log(artists);

			return this.toTrackResponse(track, source, attributes, artists);
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
		let buffer: Buffer;
		if (Buffer.isBuffer(attribute.buffer)) {
			buffer = attribute.buffer;
		} else {
			buffer = await attribute.buffer();
		}

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
		artists: TrackArtistResponse[] | null,
	): EphemeralTrackResponse {
		return {
			id: track.id,
			title: track.title,
			pluginId: source.plugin.package.name,
			libraryId: source.source.getLibraryHandler().id,
			attributes,
			artists,
		};
	}
}
