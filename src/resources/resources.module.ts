import { Module } from "@nestjs/common";
import { ResourcesController } from "./resources.controller";
import { ResourceManagerModule } from "src/resource-manager/resource-manager.module";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";

@Module({
	imports: [ResourceManagerModule, AttributeSourcesModule],
	controllers: [ResourcesController],
})
export class ResourcesModule {}
