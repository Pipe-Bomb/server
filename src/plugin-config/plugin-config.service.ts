import { Injectable, Logger } from "@nestjs/common";
import { ConfigManager } from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LoadedConfigManager } from "./interface/loaded-config-manager.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { DBConfigEntry } from "./entity/config-entry.entity";
import { Repository } from "typeorm";

@Injectable()
export class PluginConfigService {
	private readonly logger = new Logger("Plugin Config Service");
	private readonly configManagers = new Map<string, LoadedConfigManager>();

	constructor(
		@InjectRepository(DBConfigEntry)
		private readonly configEntriesRepository: Repository<DBConfigEntry>,
	) {}

	async registerConfigManager(
		configManager: ConfigManager,
		plugin: LoadedPlugin,
	) {
		if (this.configManagers.has(plugin.package.name)) {
			throw new Error("Plugin has already registered a Config Manager");
		}

		try {
			await configManager.enable({
				getValue: async (key, type, multiple) => {
					const entries = await this.configEntriesRepository.find({
						where: {
							pluginId: plugin.package.name,
							key: key,
						},
						order: {
							ordinal: "asc",
						},
					});

					const values = entries
						.map((entry) => {
							switch (type) {
								case "boolean":
									return entry.value_boolean;
								case "decimal":
									return entry.value_decimal;
								case "integer":
									return entry.value_int;
								case "string":
									return entry.value_string;
							}
						})
						.filter((value) => value !== null);

					if (!values.length) {
						return null;
					}
					if (multiple) {
						return values;
					}
					return values[0] as any;
				},
				setValue: async (key, type, values) => {
					if (!Array.isArray(values)) {
						values = [values];
					}
					const entries = values.map((value, ordinal) =>
						this.configEntriesRepository.create({
							pluginId: plugin.package.name,
							key,
							ordinal,
							value_boolean: type == "boolean" ? (value as boolean) : null,
							value_decimal: type == "decimal" ? (value as number) : null,
							value_int: type == "integer" ? (value as number) : null,
							value_string: type == "string" ? (value as string) : null,
						}),
					);

					await this.configEntriesRepository.delete({
						pluginId: plugin.package.name,
						key,
					});
					await this.configEntriesRepository.insert(entries);
					console.log("Set values:", entries);
				},
				delete: async (key) => {
					await this.configEntriesRepository.delete({
						pluginId: plugin.package.name,
						key,
					});
				},
			});

			this.configManagers.set(plugin.package.name, {
				configManager,
				plugin,
			});
			this.logger.debug(
				`Plugin "${plugin.package.name}" registered a Config Manager`,
			);
		} catch (e) {
			this.logger.error(
				`An error occured while enabling Config Manager for Plugin "${plugin.package.name}":`,
				e,
			);
		}
	}

	all() {
		return Array.from(this.configManagers.values());
	}

	find(pluginId: string) {
		return this.configManagers.get(pluginId) ?? null;
	}
}
