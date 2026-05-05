import { Module } from "@nestjs/common";
import { IconsService } from "./icons.service";
import { IconsController } from "./icons.controller";

@Module({
	controllers: [IconsController],
	providers: [IconsService],
	exports: [IconsService],
})
export class IconsModule {}
