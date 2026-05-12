import { Module } from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsController } from "./artists.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtist } from "./entity/artist.entity";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { TrackManagerModule } from "src/track-manager/track-manager.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBArtist,
			DBArtistIdentity,
			DBTrackArtist,
			DBArtistAttribute,
		]),
		TasksModule,
		AttributeSourcesModule,
		ExternalUrlsModule,
		TrackManagerModule,
	],
	controllers: [ArtistsController],
	providers: [ArtistsService],
	exports: [ArtistsService],
})
export class ArtistsModule {}
