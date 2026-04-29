import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { TracksService } from "./tracks.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { IdentifiersService } from "src/identifiers/identifiers.service";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "./response/track.response";

@Controller("tracks")
export class TracksController {
	constructor(
		private readonly tracksService: TracksService,
		private readonly identifiersService: IdentifiersService,
	) {}

	@Get(":pluginId/:libraryId/:trackId")
	@ApiOperation({ operationId: "getTrack" })
	@ApiOkResponse({
		type: TrackResponse,
	})
	async findOne(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	) {
		const track = await this.tracksService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
			relations: {
				attributes: true,
			},
		});
		return track?.toResponse() ?? null; // todo: add attributes
	}

	@Get(":pluginId/:libraryId/:trackId/identities")
	@ApiOperation({ operationId: "getTrackIdentities" })
	@ApiOkResponse({
		type: [IdentityResponse],
	})
	async getIdentities(
		@Param("pluginId") pluginId: string,
		@Param("libraryId") libraryId: string,
		@Param("trackId") trackId: string,
	): Promise<IdentityResponse[]> {
		const track = await this.tracksService.findOne({
			where: {
				pluginId,
				libraryId,
				trackId,
			},
		});
		if (!track) {
			throw new NotFoundException("Track not found");
		}
		const identities = await this.identifiersService.getTrackIdentities(track);
		return identities.map((identity) => identity.toResponse());
	}
}
