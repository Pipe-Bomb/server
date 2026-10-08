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
	StreamableFile,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { ApiQuery } from "@nestjs/swagger";
import { ResourceManagerService } from "src/resource-manager/resource-manager.service";
import { BufferAttributeStreamService } from "src/attribute-sources/buffer-attribute-stream.service";

@Controller("resources")
export class ResourcesController {
	private readonly logger = new Logger("Resources Controller");

	constructor(
		private readonly resourceManagerService: ResourceManagerService,
		private readonly bufferAttributeStreamService: BufferAttributeStreamService,
	) {}

	@Get("/:dir/:file")
	@ApiQuery({
		name: "plugin",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "source",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "entity",
		required: false,
		type: "string",
	})
	@ApiQuery({
		name: "key",
		required: false,
		type: "string",
	})
	async get(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Param("dir") dir: string,
		@Param("file") file: string,
		@Query() queryParams: Record<string, string>,
		@Query("plugin") pluginId?: string,
		@Query("source") sourceId?: string,
		@Query("entity") entity?: string,
		@Query("key") key?: string,
	): Promise<StreamableFile | void> {
		const fileInfo = this.resourceManagerService.resolveResourcePath(dir, file);
		if (!fileInfo) {
			throw new NotFoundException("Not found");
		}
		const { path, uuid, extension } = fileInfo;

		try {
			await stat(path);
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === "ENOENT") {
				throw new NotFoundException("Not found");
			}
			this.logger.error(`Failed to read resource "${file}"`, e as Error);
			throw new InternalServerErrorException("Failed to read resource");
		}

		return this.bufferAttributeStreamService.serve(
			req,
			res,
			{ uuid, extension, file },
			() => createReadStream(path),
			queryParams,
			{ pluginId, sourceId, entity, key },
		);
	}
}
