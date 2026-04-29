import { Injectable, Logger } from "@nestjs/common";
import { lstat, readdir, readFile } from "fs/promises";
import path from "path";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";

@Injectable()
export class LanguageService {
	private readonly logger = new Logger("Language Service");
	private readonly languageMaps = new Map<string, Record<string, string>>();

	constructor() {
		this.registerLanguageDirectory(
			path.join(process.cwd(), "assets/language"),
			null,
		);
	}

	// todo: support ordering sources
	async registerLanguageDirectory(
		directory: string,
		plugin: LoadedPlugin | null,
	) {
		if (plugin) {
			this.logger.debug(
				`Plugin "${plugin.package.name}" registered language directory "${directory}"`,
			);
		} else {
			this.logger.debug(`System registered language directory "${directory}"`);
		}

		try {
			const contents = await readdir(directory);
			for (const file of contents) {
				const filePath = path.join(directory, file);
				try {
					if (!file.toLowerCase().endsWith(".json")) {
						continue;
					}

					const languageId = file.substring(0, file.length - 5);

					const stats = await lstat(filePath);
					if (!stats.isFile()) {
						this.logger.debug(
							`Skipping language path "${filePath}" because it isn't a file`,
						);
						continue;
					}

					const contents = await readFile(filePath, "utf-8");
					const json: Record<string, string> = await JSON.parse(contents);
					if (typeof json != "object" || Array.isArray(json)) {
						throw new Error("Invalid language file contents");
					}

					let langRecord = this.languageMaps.get(languageId);
					if (!langRecord) {
						langRecord = {};
						this.languageMaps.set(languageId, langRecord);
					}

					let keysAdded = 0;
					for (const [key, value] of Object.entries(json)) {
						if (
							key &&
							value &&
							typeof key == "string" &&
							typeof value == "string"
						) {
							langRecord[key] = value;
							keysAdded++;
						} else {
							this.logger.debug(
								`Ignoring key "${key}" in language file "${filePath}"`,
							);
						}
					}
					if (plugin) {
						this.logger.debug(
							`Added ${keysAdded} keys to language "${languageId}" from Plugin "${plugin.package.name}"`,
						);
					} else {
						this.logger.debug(
							`Added ${keysAdded} keys to language "${languageId}"`,
						);
					}
				} catch (e) {
					this.logger.error(
						`Unexpected error while trying to load language file "${filePath}":`,
						e,
					);
				}
			}
		} catch (e) {}
	}

	getMap(languageId: string) {
		return this.languageMaps.get(languageId) ?? null;
	}

	getIds() {
		return Array.from(this.languageMaps.keys());
	}
}
