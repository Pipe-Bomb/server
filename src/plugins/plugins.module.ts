import { Module } from "@nestjs/common";
import { PluginsService } from "./plugins.service";
import { PluginsController } from "./plugins.controller";
import { LibrariesModule } from "src/libraries/libraries.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { TasksModule } from "src/tasks/tasks.module";
import { LanguageModule } from "src/language/language.module";
import { ArtistsModule } from "src/artists/artists.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { IconsModule } from "src/icons/icons.module";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { AlbumsModule } from "src/albums/albums.module";

@Module({
	imports: [
		LibrariesModule,
		IdentifiersModule,
		TasksModule,
		LanguageModule,
		AttributeSourcesModule,
		ArtistsModule,
		IconsModule,
		ExternalUrlsModule,
		AlbumsModule,
	],
	controllers: [PluginsController],
	providers: [PluginsService],
})
export class PluginsModule {}
