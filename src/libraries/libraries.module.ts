import { Module } from "@nestjs/common";
import { LibrariesService } from "./libraries.service";
import { LibrariesController } from "./libraries.controller";
import { TracksModule } from "src/tracks/tracks.module";
import { AttributesModule } from "src/attributes/attributes.module";
import { TasksModule } from "src/tasks/tasks.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";

@Module({
	imports: [TracksModule, AttributesModule, TasksModule, IdentifiersModule],
	controllers: [LibrariesController],
	providers: [LibrariesService],
	exports: [LibrariesService],
})
export class LibrariesModule {}
