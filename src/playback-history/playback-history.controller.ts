import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Post,
	Query,
} from "@nestjs/common";
import { PlaybackHistoryService } from "./playback-history.service";
import {
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ReqUser } from "src/users/user.decorator";
import type { UserJwtPayload } from "src/users/interface/user-jwt-payload.interface";
import { GetPlaybackHistoryDto } from "./dto/get-playback-history.dto";
import { ReportPlaybackDto } from "./dto/report-playback.dto";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { PlaybackHistoryPageResponse } from "./response/playback-history-page.response";
import { In } from "typeorm";
import { PlaybackHistoryEntryResponse } from "./response/playback-history-entry.response";

@Controller("playback-history")
export class PlaybackHistoryController {
	constructor(
		private readonly playbackHistoryService: PlaybackHistoryService,
		private readonly trackManagerService: TrackManagerService,
	) {}

	@Get("me")
	@ApiOperation({ operationId: "getOwnPlaybackHistory" })
	@ApiOkResponse({ type: PlaybackHistoryPageResponse })
	@ApiUnauthorizedResponse()
	async getOwnPlaybackHistory(
		@ReqUser() jwt: UserJwtPayload,
		@Query() dto: GetPlaybackHistoryDto,
	): Promise<PlaybackHistoryPageResponse> {
		const { entries, total } = await this.playbackHistoryService.getUserHistory(
			jwt.sub,
			{
				amount: dto.pageSize,
				offset: (dto.page - 1) * dto.pageSize,
				pluginId: dto.pluginId === "" ? null : dto.pluginId,
				clientName: dto.clientName,
			},
		);

		const trackIds = entries.map((entry) => entry.trackUuid);
		const trackIndexes = new Map<string, number[]>();
		for (const [index, id] of trackIds.entries()) {
			const array = trackIndexes.get(id);
			if (array) {
				array.push(index);
			} else {
				trackIndexes.set(id, [index]);
			}
		}

		const tracks = await this.trackManagerService.find({
			where: {
				uuid: In(trackIds),
			},
			relations: {
				attributes: true,
				identities: true,
				artists: {
					artist: {
						attributes: true,
					},
				},
				albums: {
					album: {
						attributes: true,
					},
				},
			},
		});

		const entryResponses: PlaybackHistoryEntryResponse[] = entries.map(
			(entry) => ({
				trackUuid: entry.trackUuid,
				pluginId: entry.pluginId,
				clientName: entry.clientName,
				datePlayed: new Date(entry.datePlayed * 1000),
				dateRecorded: new Date(entry.dateRecorded),
				track: null,
			}),
		);

		for (const track of tracks) {
			const indexes = trackIndexes.get(track.uuid);
			if (indexes) {
				for (const index of indexes) {
					entryResponses[index].track = track.toResponse();
				}
			}
		}

		return {
			entries: entryResponses,
			total,
		};
	}

	@Post("me")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ operationId: "reportPlayback" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	async reportPlayback(
		@ReqUser() jwt: UserJwtPayload,
		@Body() dto: ReportPlaybackDto,
	): Promise<void> {
		const track = await this.trackManagerService.findOne({
			where: {
				pluginId: dto.pluginId,
				libraryId: dto.libraryId,
				trackId: dto.trackId,
			},
		});

		if (!track) {
			throw new NotFoundException("Track not found");
		}

		await this.playbackHistoryService.addHistoryEntry(
			track.uuid,
			jwt.sub,
			null,
			dto.clientName,
			dto.datePlayed ?? new Date(),
		);
	}
}
