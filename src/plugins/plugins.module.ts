import { Module } from "@nestjs/common";
import { PluginsService } from "./plugins.service";
import { PluginsController } from "./plugins.controller";
import { LibrariesModule } from "src/libraries/libraries.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { TasksModule } from "src/tasks/tasks.module";
import { LanguageModule } from "src/language/language.module";
import { AttributesModule } from "src/attributes/attributes.module";

@Module({
	imports: [
		LibrariesModule,
		IdentifiersModule,
		TasksModule,
		LanguageModule,
		AttributesModule,
	],
	controllers: [PluginsController],
	providers: [PluginsService],
})
export class PluginsModule {}
