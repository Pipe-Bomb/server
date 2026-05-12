import { Module } from "@nestjs/common";
import { StreamingCoreService } from "./streaming-core.service";
import { StreamingCoreController } from "./streaming-core.controller";

@Module({
	controllers: [StreamingCoreController],
	providers: [StreamingCoreService],
	exports: [StreamingCoreService],
})
export class StreamingCoreModule {}
