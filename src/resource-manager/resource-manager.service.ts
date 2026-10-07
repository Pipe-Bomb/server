import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DBResource } from "./entities/resource.entity";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

@Injectable()
export class ResourceManagerService {
	private readonly logger = new Logger("Resources Service");

	private readonly MAX_IMAGE_DIMENSION = 4096;

	private readonly resourcesDirectory = path.resolve("resources");

	constructor(
		@InjectRepository(DBResource)
		private readonly resourcesRepository: Repository<DBResource>,
	) {}

	isValidExtension(extension: string) {
		return (
			/^([a-z0-9][a-z0-9_-]*)(\.[a-z0-9_-]+)*$/.test(extension) &&
			extension.length &&
			extension.length <= 32
		);
	}

	resolveResourcePath(dir: string, file: string) {
		if (!/^[0-9a-fA-F]{3}$/.test(dir)) {
			return null;
		}

		if (
			!file ||
			file === "." ||
			file === ".." ||
			file.includes("/") ||
			file.includes("\\") ||
			file.includes("\0") ||
			path.basename(file) !== file
		) {
			return null;
		}

		const separatorIndex = file.indexOf(".");
		if (separatorIndex === -1) {
			return null;
		}

		const uuid = file.slice(0, separatorIndex);
		const extension = file.slice(separatorIndex + 1);

		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				uuid,
			)
		) {
			return null;
		}

		if (!this.isValidExtension(extension)) {
			return null;
		}

		const resolved = path.resolve(this.resourcesDirectory, dir, file);
		if (!resolved.startsWith(this.resourcesDirectory + path.sep)) {
			return null;
		}

		return {
			path: resolved,
			uuid,
			extension,
		};
	}

	async create(buffer: Buffer, extension: string) {
		const cleanExtension = extension.normalize("NFKC").trim().toLowerCase();
		if (!this.isValidExtension(cleanExtension)) {
			throw new Error("Extension is invalid");
		}

		const sha256 = createHash("sha256").update(buffer).digest("hex");

		const existingResource = await this.resourcesRepository.findOneBy({
			sha256,
			extension: cleanExtension,
		});
		if (existingResource) {
			return existingResource;
		}

		const resource = this.resourcesRepository.create({
			extension: cleanExtension,
			sha256,
		});

		await this.resourcesRepository.insert(resource);
		const filePath = resource.getFilePath();
		this.logger.debug(`Writing resource to "${filePath}"`);

		await mkdir(path.dirname(filePath), {
			recursive: true,
		});
		await writeFile(filePath, buffer);
		return resource;
	}

	async resizeImage(
		buffer: Buffer,
		options: {
			width?: number | null;
			height?: number | null;
		},
	) {
		if (!options.width && !options.height) {
			return buffer;
		}

		const pipeline = sharp(buffer)
			.resize({
				width: options.width ?? undefined,
				height: options.height ?? undefined,
				fit: "cover",
				withoutEnlargement: true,
			})
			.webp({
				quality: 80,
				effort: 3,
			});

		return pipeline.toBuffer();
	}

	sanitizeDimension(value: unknown): number | null {
		if (value === undefined || value === null) {
			return null;
		}

		let targetValue = Array.isArray(value) ? (value as unknown[])[0] : value;

		if (typeof targetValue !== "string" && typeof targetValue !== "number") {
			return null;
		}

		if (typeof targetValue === "string") {
			targetValue = targetValue.trim();
			if (targetValue === "") {
				return null;
			}
		}

		const parsed = parseInt(targetValue as string, 10);

		if (isNaN(parsed) || parsed <= 0 || parsed > this.MAX_IMAGE_DIMENSION) {
			return null;
		}

		return parsed;
	}
}
