import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DBResource } from "./entities/resource.entity";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

@Injectable()
export class ResourcesService {
	private readonly logger = new Logger("Resources Service");

	private readonly MAX_IMAGE_DIMENSION = 4096;

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

		let targetValue = Array.isArray(value) ? value[0] : value;

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
