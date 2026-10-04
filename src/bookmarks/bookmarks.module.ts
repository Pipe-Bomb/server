import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookmarksService } from "./bookmarks.service";
import { DBSavedAlbum } from "src/albums/entity/saved-album.entity";
import { DBSavedArtist } from "src/artists/entity/saved-artist.entity";
import { DBSavedTrack } from "src/tracks/entities/saved-track.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBSavedAlbum, DBSavedArtist, DBSavedTrack]),
	],
	providers: [BookmarksService],
	exports: [BookmarksService],
})
export class BookmarksModule {}
