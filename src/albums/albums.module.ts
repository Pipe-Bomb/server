import { Module } from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { AlbumsController } from "./albums.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBAlbum } from "./entity/album.entity";
import { DBAlbumIdentity } from "./entity/album-identity.entity";
import { DBAlbumMerge } from "./entity/album-merge.entity";
import { DBSavedAlbum } from "./entity/saved-album.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { SearchModule } from "src/search/search.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { SavedAlbumsService } from "./saved-albums.service";
import { LibrariesModule } from "src/libraries/libraries.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBAlbum,
			DBAlbumIdentity,
			DBAlbumMerge,
			DBSavedAlbum,
		]),
		ArtistManagerModule,
		TasksModule,
		AlbumManagerModule,
		EphemeralModule,
		SearchModule,
		IdentifiersModule,
		LibrariesModule,
	],
	controllers: [AlbumsController],
	providers: [AlbumsService, SavedAlbumsService],
	exports: [AlbumsService, SavedAlbumsService],
})
export class AlbumsModule {}
