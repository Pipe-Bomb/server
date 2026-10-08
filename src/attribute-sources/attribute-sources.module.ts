import { Module } from "@nestjs/common";
import { AttributeSourcesService } from "./attribute-sources.service";
import { BufferAttributeStreamService } from "./buffer-attribute-stream.service";
import { AttributeSourcesController } from "./attribute-sources.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { ResourceManagerModule } from "src/resource-manager/resource-manager.module";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBTrackAttribute,
			DBArtistAttribute,
			DBAlbumAttribute,
			DBPlaylistAttribute,
		]),
		TasksModule,
		ResourceManagerModule,
	],
	controllers: [AttributeSourcesController],
	providers: [AttributeSourcesService, BufferAttributeStreamService],
	exports: [AttributeSourcesService, BufferAttributeStreamService],
})
export class AttributeSourcesModule {}
