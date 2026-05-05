import { Controller } from "@nestjs/common";
import { ExternalUrlsService } from "./external-urls.service";

@Controller()
export class ExternalUrlsController {
	constructor(private readonly externalUrlsService: ExternalUrlsService) {}
}
