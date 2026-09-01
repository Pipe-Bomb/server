import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { SearchSourceService } from "./search-source.service";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist]),
		TrackManagerModule,
		AlbumManagerModule,
		ArtistManagerModule,
	],
	controllers: [SearchController],
	providers: [SearchService, SearchSourceService],
	exports: [SearchSourceService],
})
export class SearchModule {}
