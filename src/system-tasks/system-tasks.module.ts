import { Module } from "@nestjs/common";
import { SystemTasksService } from "./system-tasks.service";
import { TasksModule } from "src/tasks/tasks.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";

@Module({
	imports: [
		TasksModule,
		IdentifiersModule,
		ArtistManagerModule,
		AlbumManagerModule,
	],
	providers: [SystemTasksService],
})
export class SystemTasksModule {}
