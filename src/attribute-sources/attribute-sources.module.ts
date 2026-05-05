import { Module } from "@nestjs/common";
import { AttributeSourcesService } from "./attribute-sources.service";
import { AttributeSourcesController } from "./attribute-sources.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { ResourcesModule } from "src/resources/resources.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBTrackAttribute, DBArtistAttribute]),
		TasksModule,
		ResourcesModule,
	],
	controllers: [AttributeSourcesController],
	providers: [AttributeSourcesService],
	exports: [AttributeSourcesService],
})
export class AttributeSourcesModule {}
