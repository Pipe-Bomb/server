import { Controller } from "@nestjs/common";
import { PlaybackHistoryService } from "./playback-history.service";

@Controller("playback-history")
export class PlaybackHistoryController {
	constructor(
		private readonly playbackHistoryService: PlaybackHistoryService,
	) {}
}
