import { Module } from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { AttributesController } from "./attributes.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBTrackAttribute } from "./entities/track-attribute.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { DBArtistAttribute } from "./entities/artist-attribute.entity";
import { ArtistsModule } from "src/artists/artists.module";
import { ResourcesModule } from "src/resources/resources.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBTrackAttribute, DBArtistAttribute]),
		TasksModule,
		ArtistsModule,
		ResourcesModule,
	],
	controllers: [AttributesController],
	providers: [AttributesService],
	exports: [AttributesService],
})
export class AttributesModule {}
