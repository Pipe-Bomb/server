import { Module } from "@nestjs/common";
import { PlaylistsService } from "./playlists.service";
import { PlaylistsController } from "./playlists.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBPlaylist } from "./entity/playlist.entity";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { UsersModule } from "src/users/users.module";
import { AttributesModule } from "src/attributes/attributes.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { LibrariesModule } from "src/libraries/libraries.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { SmartPlaylistsService } from "./smart-playlists.service";
import { DBSmartPlaylistFilter } from "./entity/smart-playlist-filter.entity";
import { DBSmartPlaylistFilterGroup } from "./entity/smart-playlist-filter-group.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBPlaylist,
			DBPlaylistTrack,
			DBSmartPlaylistFilter,
			DBSmartPlaylistFilterGroup,
		]),
		UsersModule,
		AttributesModule,
		AttributeSourcesModule,
		TrackManagerModule,
		LibrariesModule,
		EphemeralModule,
		AlbumManagerModule,
	],
	controllers: [PlaylistsController],
	providers: [PlaylistsService, SmartPlaylistsService],
})
export class PlaylistsModule {}
