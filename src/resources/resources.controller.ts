import {
	BadRequestException,
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
import mime from "mime";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { createHash } from "crypto";
import { Readable } from "stream";
import { ApiQuery } from "@nestjs/swagger";
import { ResourceManagerService } from "src/resource-manager/resource-manager.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";

const RAW_CACHE_CONTROL = "public, max-age=31536000, immutable";
const FORMATTED_CACHE_CONTROL = "public, max-age=0, must-revalidate";

const CONTROL_PARAMS = ["plugin", "source", "entity", "key"];

const ENTITY_TYPES = ["track", "artist", "album", "playlist"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

function isEntityType(value: string): value is EntityType {
	return (ENTITY_TYPES as readonly string[]).includes(value);
}

@Controller("resources")
export class ResourcesController {
	private readonly logger = new Logger("Resources Controller");

	constructor(
		private readonly resourceManagerService: ResourceManagerService,
		private readonly attributeSourcesService: AttributeSourcesService,
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

		const controlParams = [pluginId, sourceId, entity, key].filter(
			(value) => value !== undefined,
		);
		if (controlParams.length !== 0 && controlParams.length !== 4) {
			throw new BadRequestException(
				"plugin, source, entity and key must be provided together",
			);
		}

		if (pluginId && sourceId && entity && key) {
			if (!isEntityType(entity)) {
				throw new BadRequestException("Invalid entity type");
			}

			const params: Record<string, string> = {};
			for (const [paramKey, value] of Object.entries(queryParams)) {
				if (!CONTROL_PARAMS.includes(paramKey)) {
					params[paramKey] = value;
				}
			}

			return this.serveFormatted(
				req,
				res,
				{ path, uuid, extension, file },
				{
					pluginId,
					sourceId,
					entity,
					key,
				},
				params,
			);
		}

		return this.serveRaw(req, res, path, file);
	}

	private serveRaw(
		req: Request,
		res: Response,
		path: string,
		file: string,
	): StreamableFile | void {
		const etag = `"${file}"`;

		if (this.etagMatches(req.headers["if-none-match"], etag)) {
			res.set({
				"Cache-Control": RAW_CACHE_CONTROL,
				ETag: etag,
			});
			res.status(304);
			return;
		}

		const stream = createReadStream(path);
		this.trackStream(res, stream, new Set([stream]));

		res.set({
			"Content-Type": mime.getType(file) ?? "application/octet-stream",
			"Cache-Control": RAW_CACHE_CONTROL,
			ETag: etag,
		});

		return new StreamableFile(stream);
	}

	private async serveFormatted(
		req: Request,
		res: Response,
		resource: { path: string; uuid: string; extension: string; file: string },
		control: {
			pluginId: string;
			sourceId: string;
			entity: EntityType;
			key: string;
		},
		params: Record<string, string>,
	): Promise<StreamableFile | void> {
		const source = this.attributeSourcesService.getAttributeSource(
			control.pluginId,
			control.sourceId,
		);
		if (!source) {
			throw new NotFoundException("Attribute source not found");
		}

		const formatter = this.attributeSourcesService.getBufferAttributeFormatter(
			control.entity,
			control.pluginId,
			control.sourceId,
			control.key,
		);
		if (!formatter) {
			throw new NotFoundException("Attribute not found");
		}

		const etag = this.formattedEtag(
			source.plugin.package.name,
			source.plugin.package.version,
			resource.file,
			control,
			params,
		);

		if (this.etagMatches(req.headers["if-none-match"], etag)) {
			res.set({
				"Cache-Control": FORMATTED_CACHE_CONTROL,
				ETag: etag,
			});
			res.status(304);
			return;
		}

		const streams = new Set<Readable>();
		const getStream = () => {
			const stream = createReadStream(resource.path);
			streams.add(stream);
			return stream;
		};

		let result;
		try {
			result = await formatter({
				uuid: resource.uuid,
				extension: resource.extension,
				params,
				getStream,
			});
		} catch (e) {
			for (const stream of streams) {
				stream.destroy();
			}
			this.logger.error(
				`Failed to format resource "${resource.file}"`,
				e as Error,
			);
			throw new InternalServerErrorException("Failed to format resource");
		}

		if (!result) {
			for (const stream of streams) {
				stream.destroy();
			}
			throw new BadRequestException("Not handled by formatter");
		}

		streams.add(result.stream);
		this.trackStream(res, result.stream, streams);

		res.set({
			"Content-Type":
				result.contentType ??
				mime.getType(result.extension ?? resource.file) ??
				"application/octet-stream",
			"Cache-Control": FORMATTED_CACHE_CONTROL,
			ETag: etag,
		});

		return new StreamableFile(result.stream);
	}

	private formattedEtag(
		pluginName: string,
		pluginVersion: string,
		file: string,
		control: {
			sourceId: string;
			entity: EntityType;
			key: string;
		},
		params: Record<string, string>,
	): string {
		const sortedParams = Object.keys(params)
			.sort()
			.map((key) => `${key}=${params[key]}`)
			.join("&");

		const hash = createHash("sha1")
			.update(
				`${pluginName}@${pluginVersion}:${control.sourceId}:${control.entity}:${control.key}:${file}?${sortedParams}`,
			)
			.digest("hex");

		return `"${hash}"`;
	}

	private trackStream(res: Response, stream: Readable, streams: Set<Readable>) {
		stream.on("error", (e) => {
			this.logger.error("Resource stream failed", e);
			res.destroy();
		});

		res.on("close", () => {
			for (const tracked of streams) {
				tracked.destroy();
			}
		});
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
