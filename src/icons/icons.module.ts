import { Module } from "@nestjs/common";
import { IconsService } from "./icons.service";
import { IconsController } from "./icons.controller";

@Module({
	imports: [],
	controllers: [IconsController],
	providers: [IconsService],
	exports: [IconsService],
})
export class IconsModule {}
