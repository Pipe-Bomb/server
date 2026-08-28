import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { readFile } from "fs/promises";
import path from "path";
import { Repository } from "typeorm";
import { PluginsService } from "src/plugins/plugins.service";
import { MarketplaceManifestDto } from "./dto/marketplace-manifest.dto";
import { DBMarketplace } from "./entity/marketplace.entity";
import { MarketplacePluginResponse } from "./response/marketplace-plugin.response";
import { MarketplaceResponse } from "./response/marketplace.response";

const MANIFEST_TTL_MS = 5 * 60 * 1000;

interface CachedManifest {
	manifest: MarketplaceManifestDto;
	fetchedAt: number;
}

@Injectable()
export class MarketplacesService {
	private readonly logger = new Logger("Marketplace Service");
	private readonly manifestCache = new Map<string, CachedManifest>();

	constructor(
		@InjectRepository(DBMarketplace)
		private readonly marketplaceRepo: Repository<DBMarketplace>,
		private readonly pluginsService: PluginsService,
	) {}

	private async fetchManifest(
		url: string,
	): Promise<MarketplaceManifestDto | null> {
		const cached = this.manifestCache.get(url);
		if (cached && Date.now() - cached.fetchedAt < MANIFEST_TTL_MS) {
			return cached.manifest;
		}

		let parsed: unknown;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			parsed = await response.json();
		} catch (e) {
			this.logger.warn(
				`Failed to fetch manifest from "${url}": ${(e as Error).message}`,
			);
			return null;
		}

		const instance = plainToInstance(MarketplaceManifestDto, parsed);
		try {
			await validateOrReject(instance, { whitelist: true });
		} catch (e) {
			this.logger.warn(`Manifest from "${url}" failed validation:`, e);
			return null;
		}

		this.manifestCache.set(url, { manifest: instance, fetchedAt: Date.now() });

		await this.marketplaceRepo.update({ url }, { name: instance.name });

		return instance;
	}

	private async getGitRemoteUrls(): Promise<Map<string, string>> {
		const result = new Map<string, string>();
		const plugins = this.pluginsService.all();

		await Promise.all(
			plugins.map(async (plugin) => {
				const gitConfigPath = path.join(
					this.pluginsService.pluginsDirectory,
					plugin.package.name,
					".git",
					"config",
				);
				let contents: string;
				try {
					contents = await readFile(gitConfigPath, "utf-8");
				} catch {
					return;
				}

				const match = /\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/.exec(
					contents,
				);
				if (match) {
					result.set(plugin.package.name, match[1].trim());
				}
			}),
		);

		return result;
	}

	async addMarketplace(url: string): Promise<MarketplaceResponse> {
		const existing = await this.marketplaceRepo.findOne({ where: { url } });
		if (existing) {
			throw new ConflictException(`Marketplace "${url}" is already added`);
		}

		const manifest = await this.fetchManifest(url);
		if (!manifest) {
			throw new BadRequestException(
				`Could not fetch a valid manifest from "${url}"`,
			);
		}

		const entity = this.marketplaceRepo.create({ url, name: manifest.name });
		const saved = await this.marketplaceRepo.save(entity);
		return this.toMarketplaceResponse(saved, manifest);
	}

	async removeMarketplace(uuid: string): Promise<void> {
		const entity = await this.marketplaceRepo.findOne({ where: { uuid } });
		if (!entity) {
			throw new NotFoundException(`Marketplace "${uuid}" not found`);
		}
		await this.marketplaceRepo.remove(entity);
		this.manifestCache.delete(entity.url);
	}

	async listMarketplaces(): Promise<MarketplaceResponse[]> {
		const rows = await this.marketplaceRepo.find();
		return Promise.all(
			rows.map(async (row) => {
				const manifest = await this.fetchManifest(row.url);
				return this.toMarketplaceResponse(row, manifest);
			}),
		);
	}

	async listPlugins(): Promise<MarketplacePluginResponse[]> {
		const rows = await this.marketplaceRepo.find();
		const [manifests, remoteUrls] = await Promise.all([
			Promise.all(
				rows.map((row) =>
					this.fetchManifest(row.url).then((m) => ({ row, manifest: m })),
				),
			),
			this.getGitRemoteUrls(),
		]);

		const installedBases = new Set(
			Array.from(remoteUrls.values()).map((u) => u.split("#")[0]),
		);

		const results: MarketplacePluginResponse[] = [];
		for (const { row, manifest } of manifests) {
			if (!manifest) {
				continue;
			}
			for (const plugin of manifest.plugins) {
				const repositoryBase = plugin.repository.split("#")[0];
				results.push({
					id: plugin.id,
					name: plugin.name,
					description: plugin.description ?? null,
					authorName: plugin.authorName,
					authorUrl: plugin.authorUrl ?? null,
					url: plugin.url ?? null,
					repository: plugin.repository,
					marketplaceUuid: row.uuid,
					marketplaceName: manifest.name,
					installed: installedBases.has(repositoryBase),
				});
			}
		}
		return results;
	}

	private toMarketplaceResponse(
		row: DBMarketplace,
		manifest: MarketplaceManifestDto | null,
	): MarketplaceResponse {
		return {
			uuid: row.uuid,
			url: row.url,
			name: manifest?.name ?? row.name ?? null,
			pluginCount: manifest ? manifest.plugins.length : null,
			reachable: manifest !== null,
			addedAt: row.addedAt,
		};
	}
}
