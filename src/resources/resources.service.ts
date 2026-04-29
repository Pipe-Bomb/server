import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DBResource } from "./entities/resource.entity";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

@Injectable()
export class ResourcesService {
	private readonly logger = new Logger("Resources Service");

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

		await mkdir(path.dirname(filePath));
		await writeFile(filePath, buffer);
		return resource;
	}
}
