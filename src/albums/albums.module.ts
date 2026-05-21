import { Module } from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsController } from "./albums.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
import { DBAlbumArtist } from "./entity/album-artist.entity";
import { DBAlbumTrack } from "./entity/album-track.entity";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { TasksModule } from "src/tasks/tasks.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBAlbum,
			DBAlbumIdentity,
			DBAlbumArtist,
			DBAlbumTrack,
		]),
		ExternalUrlsModule,
		ArtistManagerModule,
		TasksModule,
		AlbumManagerModule,
	],
	controllers: [AlbumsController],
	providers: [AlbumsService],
	exports: [AlbumsService],
})
export class AlbumsModule {}
