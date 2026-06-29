import { Module } from "@nestjs/common";
import { PluginsService } from "./plugins.service";
import { PluginsController } from "./plugins.controller";
import { LibrariesModule } from "src/libraries/libraries.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { TasksModule } from "src/tasks/tasks.module";
import { LanguageModule } from "src/language/language.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { IconsModule } from "src/icons/icons.module";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { PluginConfigModule } from "src/plugin-config/plugin-config.module";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AudioSessionsModule } from "src/audio-sessions/audio-sessions.module";
import { UsersModule } from "src/users/users.module";
import { PlaylistsModule } from "src/playlists/playlists.module";

@Module({
	imports: [
		LibrariesModule,
		IdentifiersModule,
		TasksModule,
		LanguageModule,
		AttributeSourcesModule,
		ArtistManagerModule,
		IconsModule,
		ExternalUrlsModule,
		AlbumManagerModule,
		PluginConfigModule,
		EphemeralModule,
		TrackManagerModule,
		AudioSessionsModule,
		UsersModule,
		PlaylistsModule,
	],
	controllers: [PluginsController],
	providers: [PluginsService],
})
export class PluginsModule {}
