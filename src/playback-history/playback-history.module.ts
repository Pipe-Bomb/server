import { Module } from "@nestjs/common";
import { PlaybackHistoryService } from "./playback-history.service";
import { PlaybackHistoryController } from "./playback-history.controller";

@Module({
	controllers: [PlaybackHistoryController],
	providers: [PlaybackHistoryService],
})
export class PlaybackHistoryModule {}
