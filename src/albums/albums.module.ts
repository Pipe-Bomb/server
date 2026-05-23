import { Module } from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsController } from "./albums.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBAlbum, DBAlbumIdentity]),
		ArtistManagerModule,
		TasksModule,
		AlbumManagerModule,
		EphemeralModule,
	],
	controllers: [AlbumsController],
	providers: [AlbumsService],
	exports: [AlbumsService],
})
export class AlbumsModule {}
