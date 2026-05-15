import { Module } from "@nestjs/common";
import { AlbumManagerService } from "./album-manager.service";
import { AlbumManagerController } from "./album-manager.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBAlbum, DBAlbumArtist])],
	controllers: [AlbumManagerController],
	providers: [AlbumManagerService],
	exports: [AlbumManagerService],
})
export class AlbumManagerModule {}
