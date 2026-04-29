import { Module } from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import { ResourcesController } from "./resources.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBResource } from "./entities/resource.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBResource])],
	controllers: [ResourcesController],
	providers: [ResourcesService],
	exports: [ResourcesService],
})
export class ResourcesModule {}
