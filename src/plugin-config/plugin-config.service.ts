import { Injectable, Logger } from "@nestjs/common";
import {
	ConfigManager,
	UserConfigManager,
	ValueMap,
	ValueWithUuid,
} from "@sdk";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import {
	LoadedConfigManager,
	LoadedUserConfigManager,
} from "./interface/loaded-config-manager.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { DBConfigEntry } from "./entity/config-entry.entity";
import { Repository } from "typeorm";
import { DBUserConfigEntry } from "./entity/user-config-entry.entity";

@Injectable()
export class PluginConfigService {
	private readonly logger = new Logger("Plugin Config Service");
	private readonly configManagers = new Map<string, LoadedConfigManager>();
	private readonly userConfigManagers = new Map<
		string,
		Map<string, LoadedUserConfigManager>
	>();

	constructor(
		@InjectRepository(DBConfigEntry)
		private readonly configEntriesRepository: Repository<DBConfigEntry>,
		@InjectRepository(DBUserConfigEntry)
		private readonly userConfigEntriesRepository: Repository<DBUserConfigEntry>,
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

	async registerUserConfigManager(
		id: string,
		configManager: UserConfigManager,
		plugin: LoadedPlugin,
	) {
		if (this.userConfigManagers.get(plugin.package.name)?.has(id)) {
			throw new Error(
				`Plugin has already registered a User Config Manager with ID "${id}"`,
			);
		}

		try {
			await configManager.enable({
				getValue: async (userUuid, key, type, multiple) => {
					const entries = await this.userConfigEntriesRepository.find({
						where: {
							userUuid,
							pluginId: plugin.package.name,
							configId: id,
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
				getAllValues: async (key, type) => {
					const entries = await this.userConfigEntriesRepository.find({
						where: {
							pluginId: plugin.package.name,
							key: key,
							configId: id,
						},
						order: {
							ordinal: "asc",
						},
					});

					const map = new Map<string, ValueMap[keyof ValueMap][]>();
					const valueMap: Record<keyof ValueMap, keyof DBUserConfigEntry> = {
						boolean: "value_boolean",
						string: "value_string",
						integer: "value_int",
						decimal: "value_decimal",
					} as const;

					for (const entry of entries) {
						const value = entry[valueMap[type]];
						if (value !== null && value !== undefined) {
							const userArray = map.get(entry.userUuid);
							if (userArray) {
								userArray.push(value as keyof ValueMap);
							} else {
								map.set(entry.userUuid, [value as keyof ValueMap]);
							}
						}
					}

					const output: ValueWithUuid<any>[] = [];
					for (const [uuid, entries] of map.entries()) {
						output.push({
							userUuid: uuid,
							value: entries as (keyof ValueMap)[],
						});
					}

					return output;
				},
				setValue: async (userUuid, key, type, values) => {
					if (!Array.isArray(values)) {
						values = [values];
					}
					const entries = values.map((value, ordinal) =>
						this.userConfigEntriesRepository.create({
							userUuid,
							pluginId: plugin.package.name,
							configId: id,
							key,
							ordinal,
							value_boolean: type == "boolean" ? (value as boolean) : null,
							value_decimal: type == "decimal" ? (value as number) : null,
							value_int: type == "integer" ? (value as number) : null,
							value_string: type == "string" ? (value as string) : null,
						}),
					);

					await this.userConfigEntriesRepository.delete({
						userUuid,
						pluginId: plugin.package.name,
						configId: id,
						key,
					});
					await this.userConfigEntriesRepository.insert(entries);
				},
				delete: async (userUuid, key) => {
					await this.userConfigEntriesRepository.delete({
						userUuid,
						pluginId: plugin.package.name,
						key,
						configId: id,
					});
				},
			});

			const pluginMap = this.userConfigManagers.get(plugin.package.name);
			if (pluginMap) {
				pluginMap.set(id, { configManager, plugin, id });
			} else {
				this.userConfigManagers.set(
					plugin.package.name,
					new Map([[id, { configManager, plugin, id }]]),
				);
			}

			this.logger.debug(
				`Plugin "${plugin.package.name}" registered a User Config Manager with ID "${id}"`,
			);
		} catch (e) {
			this.logger.error(
				`An error occured while enabling User Config Manager "${id}" for Plugin "${plugin.package.name}":`,
				e,
			);
		}
	}

	allPluginConfigs() {
		return Array.from(this.configManagers.values());
	}

	allUserConfigs() {
		return Array.from(this.userConfigManagers.values()).flatMap((map) =>
			Array.from(map.values()),
		);
	}

	findPluginConfig(pluginId: string) {
		return this.configManagers.get(pluginId) ?? null;
	}

	findUserConfig(pluginId: string, configId: string) {
		return this.userConfigManagers.get(pluginId)?.get(configId) ?? null;
	}
}
