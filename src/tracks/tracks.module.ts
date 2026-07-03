import { Module } from "@nestjs/common";
import { TracksService } from "./tracks.service";
import { TracksController } from "./tracks.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBTrack } from "./entities/track.entity";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { LibrariesModule } from "src/libraries/libraries.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AudioSessionsModule } from "src/audio-sessions/audio-sessions.module";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { UsersModule } from "src/users/users.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBTrack]),
		IdentifiersModule,
		LibrariesModule,
		TrackManagerModule,
		AudioSessionsModule,
		ExternalUrlsModule,
		EphemeralModule,
		UsersModule,
	],
	controllers: [TracksController],
	providers: [TracksService],
	exports: [TracksService],
})
export class TracksModule {}
