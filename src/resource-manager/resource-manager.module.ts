import { Module } from "@nestjs/common";
import { ResourceManagerService } from "./resource-manager.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBResource } from "./entities/resource.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBResource])],
	providers: [ResourceManagerService],
	exports: [ResourceManagerService],
})
export class ResourceManagerModule {}
