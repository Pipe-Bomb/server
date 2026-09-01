import { Injectable, Logger } from "@nestjs/common";
import { SearchQuery, SearchSource, SearchSourceResults } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

interface LoadedSearchSource {
	source: SearchSource;
	pluginId: string;
}

@Injectable()
export class SearchSourceService {
	private readonly logger = new Logger(SearchSourceService.name);
	private loaded: LoadedSearchSource | null = null;

	register(source: SearchSource, plugin: LoadedPlugin): void {
		if (this.loaded) {
			this.logger.warn(
				`SearchSource already registered by "${this.loaded.pluginId}"; ignoring registration from "${plugin.package.name}"`,
			);
			return;
		}
		source.enable({});
		this.loaded = { source, pluginId: plugin.package.name };
		this.logger.log(
			`SearchSource "${source.getName()}" registered by "${plugin.package.name}"`,
		);
	}

	hasSource(): boolean {
		return this.loaded !== null;
	}

	getLoaded(): LoadedSearchSource | null {
		return this.loaded;
	}

	async search(query: SearchQuery): Promise<SearchSourceResults> {
		return this.loaded!.source.search(query);
	}
}
