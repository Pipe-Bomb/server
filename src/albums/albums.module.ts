import { Module } from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsController } from "./albums.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
import { DBAlbumArtist } from "./entity/album-artist.entity";
import { DBAlbumTrack } from "./entity/album-track.entity";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { ArtistsModule } from "src/artists/artists.module";
import { TasksModule } from "src/tasks/tasks.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBAlbum,
			DBAlbumIdentity,
			DBAlbumArtist,
			DBAlbumTrack,
		]),
		TrackManagerModule,
		ExternalUrlsModule,
		ArtistsModule,
		TasksModule,
	],
	controllers: [AlbumsController],
	providers: [AlbumsService],
	exports: [AlbumsService],
})
export class AlbumsModule {}
