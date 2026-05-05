import { Module } from "@nestjs/common";
import { TracksService } from "./tracks.service";
import { TracksController } from "./tracks.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBTrack } from "./entities/track.entity";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { LibrariesModule } from "src/libraries/libraries.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBTrack]),
		IdentifiersModule,
		LibrariesModule,
		TrackManagerModule,
	],
	controllers: [TracksController],
	providers: [TracksService],
	exports: [TracksService],
})
export class TracksModule {}
