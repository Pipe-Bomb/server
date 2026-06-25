import { Module } from "@nestjs/common";
import { AudioCacheService } from "./audio-cache.service";
import { AudioCacheController } from "./audio-cache.controller";
import { StreamingCoreModule } from "src/streaming-core/streaming-core.module";

@Module({
	imports: [StreamingCoreModule],
	controllers: [AudioCacheController],
	providers: [AudioCacheService],
	exports: [AudioCacheService],
})
export class AudioCacheModule {}
