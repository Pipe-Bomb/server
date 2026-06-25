import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsSearchDto } from "./dto/artists-search.dto";
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { ArtistsSearchResponse } from "./response/artists-search.response";
import { ArtistResponse } from "../artist-manager/response/artist.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { ArtistIdentityTarget } from "../artist-manager/enum/artist-identity-target.enum";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralSourceDto } from "src/ephemeral/dto/ephemeral-source.dto";
import { ArtistEphemeralContentResponse } from "./response/artist-ephemeral-content.response";
import { EphemeralSourceResponse } from "src/ephemeral/response/ephemeral-source.response";
import { randomUUID } from "crypto";
import { AttributesService } from "src/attributes/attributes.service";

@Controller("artists")
export class ArtistsController {
	private readonly logger = new Logger("Artists Controller");

	constructor(
		private readonly artistsService: ArtistsService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly ephemeralService: EphemeralService,
		private readonly attributesService: AttributesService,
	) {}

	@Get(":artistUuid")
	@ApiOperation({ operationId: "getArtist" })
	@ApiOkResponse({
		type: ArtistResponse,
	})
	@ApiNotFoundResponse()
	async getArtist(@Param("artistUuid") artistUuid: string) {
		const artist = await this.artistManagerService.findOne(artistUuid, {
			withAttributes: true,
			withIdentities: true,
			withTracks: 10,
			withTrackArtists: true,
			withTrackAttributes: true,
			withTrackAlbums: true,
			withAlbums: true,
			withAlbumArtists: true,
			withAlbumAttributes: true,
		});
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}
		return artist.toResponse();
	}

	@Post(":artistUuid")
	@ApiOperation({ operationId: "updateArtistMetadata" })
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({
		type: ArtistResponse,
	})
	@ApiNotFoundResponse()
	async updateArtistMetadata(@Param("artistUuid") artistUuid: string) {
		const artist = await this.artistManagerService.findOne(artistUuid);
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}

		const start = Date.now();
		this.logger.log(`Updating metadata for ${artist.uuid}`);
		const identificationResult = await this.artistManagerService.identifyArtist(
			artist,
			randomUUID(),
		);
		this.logger.log(`Found ${identificationResult.identities} identities`);
		await this.attributesService.attributeArtist(artist);
		this.logger.log(
			`Finished metadata update in ${Math.round((Date.now() - start) / 100) / 10}s`,
		);

		return this.getArtist(artist.uuid);
	}

	@Get(":pluginId/:identifierId/:identity")
	@ApiOperation({ operationId: "getArtistByIdentity" })
	@ApiOkResponse({
		type: ArtistResponse,
	})
	@ApiNotFoundResponse()
	async getArtistByIdentity(
		@Param("pluginId") pluginId: string,
		@Param("identifierId") identifierId: string,
		@Param("identity") identity: string,
	): Promise<ArtistResponse> {
		const artistUuid = await this.artistManagerService.resolveArtist(
			pluginId,
			identifierId,
			identity,
			ArtistIdentityTarget.ARTIST,
		);
		if (artistUuid) {
			return this.getArtist(artistUuid);
		}

		const artist = await this.ephemeralService.resolveEphemeralArtist(
			pluginId,
			identifierId,
			identity,
		);
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}

		return artist;
	}

	@Get(":artistUuid/ephemeral")
	@ApiOperation({ operationId: "getArtistEphemeralSources" })
	@ApiOkResponse({
		type: EphemeralSourceResponse,
		isArray: true,
	})
	@ApiNotFoundResponse()
	async getArtistEphemeralSources(
		@Param("artistUuid") artistUuid: string,
	): Promise<EphemeralSourceResponse[]> {
		const artist = await this.artistManagerService.findOne(artistUuid, {
			withIdentities: true,
		});

		if (!artist) {
			throw new NotFoundException("Artist not found");
		}

		const sources = this.ephemeralService.getEphemeralArtistSources(
			artist.identities!,
		);

		return sources.map(({ source, plugin }) => ({
			id: source.id,
			pluginId: plugin.package.name,
			name: source.getName(),
		}));
	}

	@Post(":artistUuid/ephemeral")
	@ApiOperation({ operationId: "getArtistEphemeralContent" })
	@ApiOkResponse({
		type: ArtistEphemeralContentResponse,
	})
	@ApiNotFoundResponse()
	@ApiBadRequestResponse()
	@HttpCode(HttpStatus.OK)
	async getArtistEphemeralContent(
		@Param("artistUuid") artistUuid: string,
		@Body() dto: EphemeralSourceDto,
	): Promise<ArtistEphemeralContentResponse> {
		const source = this.ephemeralService.find(dto.pluginId, dto.sourceId);
		if (!source) {
			throw new NotFoundException("Source does not exist");
		}

		const identities =
			await this.artistManagerService.findIdentities(artistUuid);

		const identifiers = this.ephemeralService.getArtistIdentifiers(source);

		const matchingIdentities = identities.filter(
			(identity) =>
				identity.pluginId == source.plugin.package.name &&
				identifiers.includes(identity.identifierId),
		);

		if (!matchingIdentities.length) {
			throw new BadRequestException("Artist is not handled by Source");
		}

		// todo: handle multiple identities
		const identity = matchingIdentities[0];
		const content = await this.ephemeralService.getEphemeralArtistContent(
			source,
			identity.identifierId,
			identity.identity,
		);

		if (!content) {
			throw new BadRequestException("Artist is not handled by Source");
		}

		return {
			source: {
				id: content.source.source.id,
				pluginId: content.source.plugin.package.name,
				name: content.source.source.getName(),
			},
			tracks: content.tracks ?? [],
			albums: content.albums ?? [],
		};
	}

	@Post(":pluginId/:identifierId/:identity")
	@ApiOperation({ operationId: "getArtistEphemeralContentByIdentity" })
	@ApiOkResponse({
		type: ArtistEphemeralContentResponse,
	})
	@ApiBadRequestResponse()
	@HttpCode(HttpStatus.OK)
	async getArtistEphemeralContentByIdentity(
		@Param("pluginId") pluginId: string,
		@Param("identifierId") identifierId: string,
		@Param("identity") identity: string,
	): Promise<ArtistEphemeralContentResponse> {
		const source = this.ephemeralService.getEphemeralSourceByArtistIdentity(
			pluginId,
			identifierId,
		);

		if (!source) {
			throw new BadRequestException("Artist not handled by Source");
		}

		const content = await this.ephemeralService.getEphemeralArtistContent(
			source,
			identifierId,
			identity,
		);

		if (!content) {
			throw new BadRequestException("Artist not handled by Source");
		}

		return {
			source: {
				id: content.source.source.id,
				pluginId: content.source.plugin.package.name,
				name: content.source.source.getName(),
			},
			tracks: content.tracks ?? [],
			albums: content.albums ?? [],
		};
	}

	@ApiOperation({ operationId: "searchArtists" })
	@ApiOkResponse({
		type: ArtistsSearchResponse,
	})
	@Post()
	async search(@Body() dto: ArtistsSearchDto): Promise<ArtistsSearchResponse> {
		const artists = await this.artistManagerService.findMany({
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
		const artist = await this.artistManagerService.findOne(artistUuid);
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}
		return this.artistManagerService.getExternalUrls(artist);
	}
}
