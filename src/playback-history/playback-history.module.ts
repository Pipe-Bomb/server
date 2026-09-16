import { Module } from "@nestjs/common";
import { PlaybackHistoryService } from "./playback-history.service";
import { PlaybackHistoryController } from "./playback-history.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBPlaybackHistoryEntry } from "./entity/playback-history-entry.entity";
import { TrackManagerModule } from "src/track-manager/track-manager.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBPlaybackHistoryEntry]),
		TrackManagerModule,
	],
	controllers: [PlaybackHistoryController],
	providers: [PlaybackHistoryService],
	exports: [PlaybackHistoryService],
})
export class PlaybackHistoryModule {}
