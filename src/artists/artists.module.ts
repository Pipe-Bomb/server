import { Module } from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsController } from "./artists.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TasksModule } from "src/tasks/tasks.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { AttributesModule } from "src/attributes/attributes.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist]),
		TasksModule,
		ArtistManagerModule,
		EphemeralModule,
		AttributesModule,
	],
	controllers: [ArtistsController],
	providers: [ArtistsService],
	exports: [ArtistsService],
})
export class ArtistsModule {}
