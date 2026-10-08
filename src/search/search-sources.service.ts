import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
	SearchQuery,
	SearchSource,
	SearchSourceInfo,
	SearchSourceResults,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { DBSearchConfig } from "./entity/search-config.entity";

interface LoadedSearchSource {
	source: SearchSource;
	plugin: LoadedPlugin;
}

export interface SearchSourceSummary {
	pluginId: string;
	sourceId: string;
	name: string;
	active: boolean;
}

interface ActiveSource {
	pluginId: string;
	sourceId: string;
}

@Injectable()
export class SearchSourcesService {
	private readonly logger = new Logger("Search Sources Service");
	private readonly sources = new Map<string, Map<string, LoadedSearchSource>>();
	private activeSource: ActiveSource | null = null;

	constructor(
		@InjectRepository(DBSearchConfig)
		private readonly searchConfigRepository: Repository<DBSearchConfig>,
	) {
		this.searchConfigRepository.findOne({ where: { id: 1 } }).then((config) => {
			if (config?.activePluginId && config?.activeSourceId) {
				this.activeSource = {
					pluginId: config.activePluginId,
					sourceId: config.activeSourceId,
				};
			}
		});
	}

	register(source: SearchSource, plugin: LoadedPlugin): void {
		const pluginSources = this.sources.get(plugin.package.name);
		if (pluginSources) {
			if (pluginSources.has(source.id)) {
				throw new Error(
					`Plugin "${plugin.package.name}" has already registered Search Source with ID "${source.id}"`,
				);
			}
			pluginSources.set(source.id, { source, plugin });
		} else {
			this.sources.set(
				plugin.package.name,
				new Map([[source.id, { source, plugin }]]),
			);
		}
		source.enable({});
		this.logger.log(
			`Plugin "${plugin.package.name}" registered Search Source "${source.id}"`,
		);
	}

	private getActive(): LoadedSearchSource | null {
		if (this.activeSource) {
			const loaded = this.sources
				.get(this.activeSource.pluginId)
				?.get(this.activeSource.sourceId);
			if (loaded) {
				return loaded;
			}
		}
		return null;
	}

	hasSource(): boolean {
		return this.getActive() !== null;
	}

	getLoaded(): LoadedSearchSource | null {
		return this.getActive();
	}

	getSource(pluginId: string, sourceId: string): SearchSource | null {
		return this.sources.get(pluginId)?.get(sourceId)?.source ?? null;
	}

	getAllSources(): SearchSourceInfo[] {
		const result: SearchSourceInfo[] = [];
		for (const [pluginId, pluginSources] of this.sources) {
			for (const [sourceId, loaded] of pluginSources) {
				result.push({ pluginId, sourceId, source: loaded.source });
			}
		}
		return result;
	}

	getAll(): SearchSourceSummary[] {
		const active = this.getActive();
		const result: SearchSourceSummary[] = [];
		for (const [pluginId, pluginSources] of this.sources) {
			for (const [sourceId, loaded] of pluginSources) {
				result.push({
					pluginId,
					sourceId,
					name: loaded.source.getName(),
					active: loaded === active,
				});
			}
		}
		return result;
	}

	async setActive(pluginId: string, sourceId: string): Promise<void> {
		if (!this.sources.get(pluginId)?.has(sourceId)) {
			throw new NotFoundException(
				`SearchSource "${sourceId}" from plugin "${pluginId}" is not registered`,
			);
		}
		this.activeSource = { pluginId, sourceId };
		await this.searchConfigRepository.save({
			id: 1,
			activePluginId: pluginId,
			activeSourceId: sourceId,
		});
	}

	async clearActive(): Promise<void> {
		this.activeSource = null;
		await this.searchConfigRepository.save({
			id: 1,
			activePluginId: null,
			activeSourceId: null,
		});
	}

	async search(query: SearchQuery): Promise<SearchSourceResults> {
		const loaded = this.getActive()!;

		const entities = {
			tracks: !!query.entities.tracks,
			albums: !!query.entities.albums,
			artists: !!query.entities.artists,
		};

		const caps = loaded.source.getCapabilities(entities);

		if (query.sort) {
			const valid =
				caps.sortMethods?.some((m) => m.key === query.sort!.key) ?? false;
			if (!valid) {
				throw new BadRequestException(
					`Sort key "${query.sort.key}" is not supported by this search source for the requested entities`,
				);
			}
		}

		if (query.filters?.length) {
			const allCaps = loaded.source.getCapabilities({
				tracks: true,
				albums: true,
				artists: true,
			});
			const filterable = allCaps.filterableAttributes ?? [];
			for (const filter of query.filters) {
				const valid = filterable.some(
					(a) =>
						a.entityType === filter.entityType &&
						a.attributeKey === filter.attributeKey &&
						a.attributeType === filter.attributeType,
				);
				if (!valid) {
					throw new BadRequestException(
						`Filter "${filter.entityType}.${filter.attributeKey}" (${filter.attributeType}) is not a supported filterable attribute`,
					);
				}
			}
		}

		return loaded.source.search(query);
	}
}
