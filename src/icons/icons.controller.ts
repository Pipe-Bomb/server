import {
	Controller,
	Get,
	NotFoundException,
	Param,
	Res,
	StreamableFile,
} from "@nestjs/common";
import { IconsService } from "./icons.service";
import { createReadStream } from "fs";
import mime from "mime";
import type { Response } from "express";

@Controller("icons")
export class IconsController {
	constructor(private readonly iconsService: IconsService) {}

	@Get(":pluginId/:iconId")
	getIcon(
		@Param("pluginId") pluginId: string,
		@Param("iconId") iconId: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const icon = this.iconsService.getIcon(pluginId, iconId);
		if (!icon) {
			throw new NotFoundException("Icon not found");
		}

		const file = createReadStream(icon.path);

		res.set({
			"Content-Type": mime.getType(icon.path),
		});

		return new StreamableFile(file);
	}
}
