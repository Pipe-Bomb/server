import { Module } from "@nestjs/common";
import { AudioSessionsService } from "./audio-sessions.service";
import { AudioSessionsController } from "./audio-sessions.controller";
import { LibrariesModule } from "src/libraries/libraries.module";
import { StreamingCoreModule } from "src/streaming-core/streaming-core.module";
import { AudioCacheModule } from "src/audio-cache/audio-cache.module";

@Module({
	imports: [LibrariesModule, StreamingCoreModule, AudioCacheModule],
	controllers: [AudioSessionsController],
	providers: [AudioSessionsService],
	exports: [AudioSessionsService],
})
export class AudioSessionsModule {}
