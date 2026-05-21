import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PluginsModule } from "./plugins/plugins.module";
import { LibrariesModule } from "./libraries/libraries.module";
import { IdentifiersModule } from "./identifiers/identifiers.module";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TracksModule } from "./tracks/tracks.module";
import { DocsModule } from "./docs/docs.module";
import { AttributesModule } from "./attributes/attributes.module";
import { TasksModule } from "./tasks/tasks.module";
import { LanguageModule } from "./language/language.module";
import { ArtistsModule } from "./artists/artists.module";
import { ResourcesModule } from "./resources/resources.module";
import { AttributeSourcesModule } from "./attribute-sources/attribute-sources.module";
import { IconsModule } from "./icons/icons.module";
import { ExternalUrlsModule } from "./external-urls/external-urls.module";
import { TrackManagerModule } from "./track-manager/track-manager.module";
import { AudioSessionsModule } from "./audio-sessions/audio-sessions.module";
import { AudioCacheModule } from "./audio-cache/audio-cache.module";
import { StreamingCoreModule } from "./streaming-core/streaming-core.module";
import { AlbumsModule } from "./albums/albums.module";
import { AlbumManagerModule } from "./album-manager/album-manager.module";
import { PluginConfigModule } from "./plugin-config/plugin-config.module";
import { SearchModule } from "./search/search.module";
import { EphemeralModule } from "./ephemeral/ephemeral.module";
import { UsersModule } from "./users/users.module";
import { SecretsModule } from "./secrets/secrets.module";
import databaseConfig from "./config/database.config";

@Module({
	imports: [
		ConfigModule.forRoot({
			envFilePath: [".development.env"],
			isGlobal: true,
			cache: true,
		}),
		TypeOrmModule.forRootAsync(databaseConfig.asProvider()),
		PluginsModule,
		LibrariesModule,
		IdentifiersModule,
		TracksModule,
		DocsModule,
		AttributesModule,
		TasksModule,
		LanguageModule,
		ArtistsModule,
		ResourcesModule,
		AttributeSourcesModule,
		IconsModule,
		ExternalUrlsModule,
		TrackManagerModule,
		AudioSessionsModule,
		AudioCacheModule,
		StreamingCoreModule,
		AlbumsModule,
		AlbumManagerModule,
		PluginConfigModule,
		SearchModule,
		EphemeralModule,
		UsersModule,
		SecretsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
