import { Module } from "@nestjs/common";
import { TrackManagerService } from "./track-manager.service";
import { TrackManagerController } from "./track-manager.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBTrack])],
	controllers: [TrackManagerController],
	providers: [TrackManagerService],
	exports: [TrackManagerService],
})
export class TrackManagerModule {}
