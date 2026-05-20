import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtist } from "src/artists/entity/artist.entity";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist]),
		TrackManagerModule,
		AlbumManagerModule,
	],
	controllers: [SearchController],
	providers: [SearchService],
})
export class SearchModule {}
