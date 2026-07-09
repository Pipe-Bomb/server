import { Module } from "@nestjs/common";
import { TrackManagerService } from "./track-manager.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";
import { WorkflowsModule } from "src/workflows/workflows.module";

@Module({
	imports: [TypeOrmModule.forFeature([DBTrack]), WorkflowsModule],
	providers: [TrackManagerService],
	exports: [TrackManagerService],
})
export class TrackManagerModule {}
