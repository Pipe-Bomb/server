import { Controller, Get, Logger, Param, Query, Res } from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import type { Response } from "express";
import { join } from "path";
import mime from "mime";
import { readFile } from "fs/promises";
import { ApiQuery } from "@nestjs/swagger";

@Controller("resources")
export class ResourcesController {
	private readonly logger = new Logger("Resources Controller");

	constructor(private readonly resourcesService: ResourcesService) {}

	@Get("/:dir/:file")
	@ApiQuery({
		name: "width",
		required: false,
		type: "integer",
	})
	@ApiQuery({
		name: "height",
		required: false,
		type: "integer",
	})
	async get(
		@Res() res: Response,
		@Param("dir") dir: string,
		@Param("file") file: string,
		@Query("width") widthStr?: string,
		@Query("height") heightStr?: string,
	) {
		try {
			if (dir.length == 3) {
				const path = join("resources", dir, file);
				const mimeType = mime.getType(file);
				if (mimeType) {
					const buffer = await readFile(path);

					const width = this.resourcesService.sanitizeDimension(widthStr);
					const height = this.resourcesService.sanitizeDimension(heightStr);

					if (width || height) {
						const resized = await this.resourcesService.resizeImage(buffer, {
							width,
							height,
						});

						res.type("image/webp").send(resized);
					} else {
						res.type(mimeType).send(buffer);
					}
				}
				return;
			}
		} catch (e) {
			this.logger.error(e);
		}
		res.status(404).type("text/html").send("Not found");
	}
}
