import { Module } from "@nestjs/common";
import { AlbumManagerService } from "./album-manager.service";
import { AlbumManagerController } from "./album-manager.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { DBAlbumIdentity } from "src/albums/entity/album-identity.entity";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBAlbum,
			DBAlbumArtist,
			DBAlbumIdentity,
			DBAlbumTrack,
		]),
		ExternalUrlsModule,
	],
	controllers: [AlbumManagerController],
	providers: [AlbumManagerService],
	exports: [AlbumManagerService],
})
export class AlbumManagerModule {}
