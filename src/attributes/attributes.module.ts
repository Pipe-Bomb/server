import { Module } from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { AttributesController } from "./attributes.controller";
import { TasksModule } from "src/tasks/tasks.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { AttributeUploadService } from "./attribute-upload.service";
import { UsersModule } from "src/users/users.module";

@Module({
	imports: [
		TasksModule,
		ArtistManagerModule,
		AttributeSourcesModule,
		AlbumManagerModule,
		UsersModule,
	],
	controllers: [AttributesController],
	providers: [AttributesService, AttributeUploadService],
	exports: [AttributesService, AttributeUploadService],
})
export class AttributesModule {}
