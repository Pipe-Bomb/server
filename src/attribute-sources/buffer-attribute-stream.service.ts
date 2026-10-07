import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	StreamableFile,
} from "@nestjs/common";
import type { Request, Response } from "express";
import mime from "mime";
import { createHash } from "crypto";
import { Readable } from "stream";
import { AttributeSourcesService } from "./attribute-sources.service";

export const RAW_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const FORMATTED_CACHE_CONTROL = "public, max-age=0, must-revalidate";

const CONTROL_PARAMS = ["plugin", "source", "entity", "key"];

const ENTITY_TYPES = ["track", "artist", "album", "playlist"] as const;
export type BufferAttributeEntity = (typeof ENTITY_TYPES)[number];

function isBufferAttributeEntity(
	value: string,
): value is BufferAttributeEntity {
	return (ENTITY_TYPES as readonly string[]).includes(value);
}

export interface BufferAttributeTarget {
	uuid: string;
	extension: string;
	file: string;
}

export interface BufferAttributeControl {
	pluginId: string;
	sourceId: string;
	entity: BufferAttributeEntity;
	key: string;
}

export interface BufferAttributeControlArgs {
	pluginId?: string;
	sourceId?: string;
	entity?: string;
	key?: string;
}

export interface ParsedBufferAttributeQuery {
	params: Record<string, string>;
	control: BufferAttributeControl | null;
}

export function parseBufferAttributeQuery(
	queryParams: Record<string, string>,
	{ pluginId, sourceId, entity, key }: BufferAttributeControlArgs,
): ParsedBufferAttributeQuery {
	const supplied = [pluginId, sourceId, entity, key].filter(
		(value) => value !== undefined,
	);
	if (supplied.length !== 0 && supplied.length !== 4) {
		throw new BadRequestException(
			"plugin, source, entity and key must be provided together",
		);
	}

	const params: Record<string, string> = {};
	for (const [paramKey, value] of Object.entries(queryParams)) {
		if (!CONTROL_PARAMS.includes(paramKey)) {
			params[paramKey] = value;
		}
	}

	if (pluginId && sourceId && entity && key) {
		if (!isBufferAttributeEntity(entity)) {
			throw new BadRequestException("Invalid entity type");
		}
		return { params, control: { pluginId, sourceId, entity, key } };
	}

	return { params, control: null };
}

@Injectable()
export class BufferAttributeStreamService {
	private readonly logger = new Logger("Buffer Attribute Stream Service");

	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	async serve(
		req: Request,
		res: Response,
		target: BufferAttributeTarget,
		getStream: () => Readable,
		queryParams: Record<string, string>,
		controlArgs: BufferAttributeControlArgs,
	): Promise<StreamableFile | void> {
		const { params, control } = parseBufferAttributeQuery(
			queryParams,
			controlArgs,
		);

		if (!control) {
			return this.serveRaw(req, res, target, getStream);
		}

		return this.serveFormatted(req, res, target, getStream, control, params);
	}

	private serveRaw(
		req: Request,
		res: Response,
		target: BufferAttributeTarget,
		getStream: () => Readable,
	): StreamableFile | void {
		const etag = `"${target.file}"`;

		if (this.etagMatches(req.headers["if-none-match"], etag)) {
			res.set({
				"Cache-Control": RAW_CACHE_CONTROL,
				ETag: etag,
			});
			res.status(304);
			return;
		}

		const stream = getStream();
		this.trackStream(res, stream, new Set([stream]));

		res.set({
			"Content-Type": mime.getType(target.file) ?? "application/octet-stream",
			"Cache-Control": RAW_CACHE_CONTROL,
			ETag: etag,
		});

		return new StreamableFile(stream);
	}

	private async serveFormatted(
		req: Request,
		res: Response,
		target: BufferAttributeTarget,
		getStream: () => Readable,
		control: BufferAttributeControl,
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
			target.file,
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
		const trackedGetStream = () => {
			const stream = getStream();
			streams.add(stream);
			return stream;
		};

		let result;
		try {
			result = await formatter({
				uuid: target.uuid,
				extension: target.extension,
				params,
				getStream: trackedGetStream,
			});
		} catch (e) {
			for (const stream of streams) {
				stream.destroy();
			}
			this.logger.error(
				`Failed to format resource "${target.file}"`,
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
				mime.getType(result.extension ?? target.file) ??
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
		control: Pick<BufferAttributeControl, "sourceId" | "entity" | "key">,
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
