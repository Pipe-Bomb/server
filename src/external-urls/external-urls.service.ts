import { Injectable, Logger } from "@nestjs/common";
import { ArtistExternalUrlHelper, ExternalUrl, ExternalUrlSource } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedExternalUrlSource } from "./interface/loaded-external-url-source.interface";
import { IconsService } from "src/icons/icons.service";
import { ExternalUrlResponse } from "./response/external-url.response";

@Injectable()
export class ExternalUrlsService {
	private readonly logger = new Logger("External Urls Service");

	private readonly sources = new Map<string, Set<LoadedExternalUrlSource>>();

	constructor(private readonly iconsService: IconsService) {}

	public registerSource(source: ExternalUrlSource, plugin: LoadedPlugin) {
		const set = this.sources.get(plugin.package.name);
		if (set) {
			for (const entry of set) {
				if (entry.source == source) {
					this.logger.warn(
						`Plugin "${plugin.package.name}" attempted to register the same External Url Source twice`,
					);
					return;
				}
			}
			set.add({
				source,
				plugin,
			});
		} else {
			this.sources.set(plugin.package.name, new Set([{ source, plugin }]));
		}
		this.logger.log(
			`Plugin "${plugin.package.name}" registered an External Url Source`,
		);
	}

	private allFlat() {
		return Array.from(this.sources.values()).flatMap((set) =>
			Array.from(set.values()),
		);
	}

	private get(
		urlGetter: (source: ExternalUrlSource) => ExternalUrl[] | null,
	): ExternalUrlResponse[] {
		const urls: ExternalUrlResponse[] = [];

		const sources = this.allFlat();
		for (const { source, plugin } of sources) {
			const sourceUrls = urlGetter(source);
			if (sourceUrls?.length) {
				for (const url of sourceUrls) {
					const icon = this.iconsService.getIcon(
						plugin.package.name,
						url.iconId,
					);
					if (icon) {
						urls.push({
							url: url.url,
							name: url.name,
							iconUrl: `/icons/${plugin.package.name}/${icon.id}`,
						});
					} else {
						this.logger.warn(
							`Ignoring External Url from Plugin "${plugin.package.name}" that attempted to use nonexistent Icon "${url.iconId}"`,
						);
					}
				}
			}
		}

		return urls;
	}

	public getArtistUrls(helper: ArtistExternalUrlHelper) {
		return this.get((source) => source.getArtistUrls(helper));
	}
}
