import { Controller, Get, Logger, Param, Res } from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import type { Response } from "express";
import { join } from "path";
import mime from "mime";
import { readFile } from "fs/promises";

@Controller("resources")
export class ResourcesController {
	private readonly logger = new Logger("Resources Controller");

	constructor(private readonly resourcesService: ResourcesService) {}

	@Get("/:dir/:file")
	async get(
		@Param("dir") dir: string,
		@Param("file") file: string,
		@Res() res: Response,
	) {
		try {
			if (dir.length == 3) {
				const path = join("resources", dir, file);
				const mimeType = mime.getType(file);
				if (mimeType) {
					const buffer = await readFile(path);
					res.type(mimeType).send(buffer);
				}
				return;
			}
		} catch (e) {
			this.logger.error(e);
		}
		res.status(404).type("text/html").send("Not found");
	}
}
