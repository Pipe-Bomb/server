import { Module } from "@nestjs/common";
import { AudioSessionsService } from "./audio-sessions.service";
import { AudioSessionsController } from "./audio-sessions.controller";
import { LibrariesModule } from "src/libraries/libraries.module";

@Module({
	imports: [LibrariesModule],
	controllers: [AudioSessionsController],
	providers: [AudioSessionsService],
	exports: [AudioSessionsService],
})
export class AudioSessionsModule {}
