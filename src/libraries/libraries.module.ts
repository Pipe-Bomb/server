import { Module } from "@nestjs/common";
import { LibrariesService } from "./libraries.service";
import { LibrariesController } from "./libraries.controller";
import { AttributesModule } from "src/attributes/attributes.module";
import { TasksModule } from "src/tasks/tasks.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AudioCacheModule } from "src/audio-cache/audio-cache.module";

@Module({
	imports: [
		TrackManagerModule,
		AttributesModule,
		TasksModule,
		IdentifiersModule,
		AttributeSourcesModule,
		AudioCacheModule,
	],
	controllers: [LibrariesController],
	providers: [LibrariesService],
	exports: [LibrariesService],
})
export class LibrariesModule {}
