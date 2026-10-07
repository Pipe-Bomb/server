import {
	Controller,
	Get,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	Param,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import { ResourcesService } from "./resources.service";
import type { Request, Response } from "express";
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
		@Req() req: Request,
		@Res() res: Response,
		@Param("dir") dir: string,
		@Param("file") file: string,
		@Query("width") widthStr?: string,
		@Query("height") heightStr?: string,
	) {
		const path = this.resourcesService.resolveResourcePath(dir, file);
		if (!path) {
			throw new NotFoundException("Not found");
		}

		const width = this.resourcesService.sanitizeDimension(widthStr);
		const height = this.resourcesService.sanitizeDimension(heightStr);
		const resized = Boolean(width || height);

		const etag = resized
			? `"${file}:${width ?? 0}x${height ?? 0}"`
			: `"${file}"`;

		if (this.etagMatches(req.headers["if-none-match"], etag)) {
			res.set({
				"Cache-Control": "public, max-age=31536000, immutable",
				ETag: etag,
			});
			res.status(304).end();
			return;
		}

		let buffer: Buffer;
		try {
			buffer = await readFile(path);
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === "ENOENT") {
				throw new NotFoundException("Not found");
			}
			this.logger.error(
				`Failed to read resource (${req.method} ${req.path})`,
				e as Error,
			);
			throw new InternalServerErrorException("Failed to read resource");
		}

		let body: Buffer;
		let contentType: string;
		if (resized) {
			try {
				body = await this.resourcesService.resizeImage(buffer, {
					width,
					height,
				});
			} catch (e) {
				this.logger.error(
					`Failed to resize resource (${req.method} ${req.path})`,
					e as Error,
				);
				throw new InternalServerErrorException("Failed to resize resource");
			}
			contentType = "image/webp";
		} else {
			body = buffer;
			contentType = mime.getType(file) ?? "application/octet-stream";
		}

		res.set({
			"Cache-Control": "public, max-age=31536000, immutable",
			ETag: etag,
		});
		res.type(contentType).send(body);
	}

	private etagMatches(header: string | undefined, etag: string): boolean {
		if (!header) {
			return false;
		}

		if (header.trim() === "*") {
			return true;
		}

		return header
			.split(",")
			.map((value) => value.trim().replace(/^W\//, ""))
			.includes(etag);
	}
}
