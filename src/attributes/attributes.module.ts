import { Module } from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { AttributesController } from "./attributes.controller";
import { TasksModule } from "src/tasks/tasks.module";
import { ArtistsModule } from "src/artists/artists.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { AlbumsModule } from "src/albums/albums.module";

@Module({
	imports: [TasksModule, ArtistsModule, AlbumsModule, AttributeSourcesModule],
	controllers: [AttributesController],
	providers: [AttributesService],
	exports: [AttributesService],
})
export class AttributesModule {}
