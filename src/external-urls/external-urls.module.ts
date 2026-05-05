import { Module } from "@nestjs/common";
import { ExternalUrlsService } from "./external-urls.service";
import { ExternalUrlsController } from "./external-urls.controller";
import { IconsModule } from "src/icons/icons.module";

@Module({
	imports: [IconsModule],
	controllers: [ExternalUrlsController],
	providers: [ExternalUrlsService],
	exports: [ExternalUrlsService],
})
export class ExternalUrlsModule {}
