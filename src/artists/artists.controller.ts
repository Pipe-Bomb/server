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
import { ArtistResponse } from "../artist-manager/response/artist.response";
import { ExternalUrlResponse } from "src/external-urls/response/external-url.response";
import { ArtistIdentityTarget } from "../artist-manager/enum/artist-identity-target.enum";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { EphemeralService } from "src/ephemeral/ephemeral.service";

@Controller("artists")
export class ArtistsController {
	constructor(
		private readonly artistsService: ArtistsService,
		private readonly artistManagerService: ArtistManagerService,
		private readonly ephemeralService: EphemeralService,
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
			withAlbums: 10,
			withAlbumArtists: true,
			withAlbumAttributes: true,
		});
		if (!artist) {
			throw new NotFoundException("Artist not found");
		}
		return artist.toResponse();
	}

	@Get(":pluginId/:identifierId/:identity")
	@ApiOperation({ operationId: "getArtistByIdentity" })
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
		console.log("Time to find ephemeral artist");

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
