import { Controller } from "@nestjs/common";
import { PluginsService } from "./plugins.service";

@Controller("plugins")
export class PluginsController {
	constructor(private readonly pluginsService: PluginsService) {}
}
