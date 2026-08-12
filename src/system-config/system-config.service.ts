import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DBSystemConfig } from "./entity/system-config.entity";
import { SystemConfigType } from "./interface/system-config-type.interface";
import {
	AnyRegisteredSystemConfigOption,
	RegisteredSystemConfigOption,
} from "./interface/registered-system-config-option.interface";
import { SystemConfigValue } from "./interface/system-config-value.interface";
import { SystemConfigOptions } from "./interface/system-config-options.interface";
import { InvalidSystemConfigValueError } from "./error/invalid-system-config-value.error";

@Injectable()
export class SystemConfigService {
	private readonly logger = new Logger("System Config Service");
	private readonly registeredOptions = new Map<
		string,
		RegisteredSystemConfigOption
	>();

	constructor(
		@InjectRepository(DBSystemConfig)
		private readonly systemConfigRepository: Repository<DBSystemConfig>,
	) {}

	registerOption<
		T extends keyof SystemConfigType,
		V extends SystemConfigType[T],
	>(
		key: string,
		type: T,
		options: SystemConfigOptions[T],
		defaultValue: V,
		...extraValues: V[]
	): void {
		if (this.registeredOptions.has(key)) {
			throw new Error(
				`System Config option "${key}" has already been registered`,
			);
		}
		this.registeredOptions.set(key, {
			type,
			options,
			defaultValues: [defaultValue, ...extraValues],
		});
	}

	private extractValue(entry: DBSystemConfig, type: keyof SystemConfigType) {
		switch (type) {
			case "boolean":
				return entry.value_boolean;
			case "integer":
				return entry.value_int;
			case "string":
				return entry.value_string;
			case "decimal":
				return entry.value_decimal;
			default:
				return null;
		}
	}

	getOption<T extends keyof SystemConfigType>(
		key: string,
		type: T,
		supportMultiple?: false,
	): Promise<SystemConfigType[T]>;
	getOption<T extends keyof SystemConfigType>(
		key: string,
		type: T,
		supportMultiple: true,
	): Promise<SystemConfigType[T][]>;
	async getOption<
		T extends keyof SystemConfigType,
		V extends SystemConfigType[T],
	>(key: string, type: T, supportMultiple?: boolean): Promise<V | V[]> {
		const registeredOption = this.registeredOptions.get(key);
		if (!registeredOption) {
			throw new Error(`System Config option "${key}" is not registered`);
		}

		if (registeredOption.type != type) {
			throw new Error(
				`System Config option "${key}" is type "${registeredOption.type}"`,
			);
		}

		const entries = await this.systemConfigRepository.find({
			where: { key },
			order: { ordinal: "asc" },
		});

		const values: any[] = [];
		for (const entry of entries) {
			const value = this.extractValue(entry, type);
			if (value !== null) {
				values.push(value);
			}
		}
		if (!values.length) {
			if (entries.length) {
				this.logger.warn(
					`System Config option "${key}" is incorrectly typed in the database, falling back to default value`,
				);
			}
			values.push(...registeredOption.defaultValues);
		}

		if (supportMultiple) {
			return [...values];
		}
		return values[0];
	}

	async getOptions(keys: string[]): Promise<SystemConfigValue[]> {
		if (!keys.length) {
			return [];
		}

		for (const key of keys) {
			if (!this.registeredOptions.has(key)) {
				throw new Error(`System Config option "${key}" is not registered`);
			}
		}

		const rawEntries = await this.systemConfigRepository.find({
			where: { key: In(keys) },
			order: { ordinal: "asc" },
		});

		const entriesByKey = new Map<string, DBSystemConfig[]>();
		for (const entry of rawEntries) {
			const list = entriesByKey.get(entry.key);
			if (list) {
				list.push(entry);
			} else {
				entriesByKey.set(entry.key, [entry]);
			}
		}

		return keys.map((key) => {
			const registeredOption = this.registeredOptions.get(key)!;
			const keyEntries = entriesByKey.get(key) ?? [];

			const values: any[] = [];
			for (const entry of keyEntries) {
				const value = this.extractValue(entry, registeredOption.type);
				if (value !== null) {
					values.push(value);
				}
			}

			if (!values.length) {
				if (keyEntries.length) {
					this.logger.warn(
						`System Config option "${key}" is incorrectly typed in the database, falling back to default value`,
					);
				}
				values.push(...registeredOption.defaultValues);
			}

			if (registeredOption.options.supportsMultiple) {
				return {
					key,
					type: registeredOption.type,
					supportsMultiple: true,
					value: [...values],
				} as SystemConfigValue;
			}

			return {
				key,
				type: registeredOption.type,
				supportsMultiple: false,
				value: [values[0]],
			} as SystemConfigValue;
		});
	}

	async setOption<T extends keyof SystemConfigType>(
		key: string,
		type: T,
		value: SystemConfigType[T] | SystemConfigType[T][],
	): Promise<void> {
		const registeredOption = this.registeredOptions.get(
			key,
		) as AnyRegisteredSystemConfigOption;
		if (!registeredOption) {
			throw new Error(`System Config option "${key}" is not registered`);
		}

		if (registeredOption.type !== type) {
			throw new Error(
				`System Config option "${key}" is type "${registeredOption.type}"`,
			);
		}

		const isMultipleInput = Array.isArray(value);

		if (isMultipleInput && !registeredOption.options.supportsMultiple) {
			throw new Error(
				`System Config option "${key}" does not support multiple values`,
			);
		}

		const values = isMultipleInput ? value : [value];

		for (const [index, value] of values.entries()) {
			if (registeredOption.type == "string") {
				if (typeof value != "string") {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must be type "string"`,
					);
				}
				const { minLength, maxLength, transform } = registeredOption.options;
				if (minLength !== undefined && value.length < minLength) {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must not be shorter than ${minLength} characters`,
					);
				}
				if (maxLength !== undefined && value.length > maxLength) {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must not be longer than ${maxLength} characters`,
					);
				}
				if (transform) {
					values[index] = transform(value) as SystemConfigType[T];
				}
			}
			if (
				registeredOption.type == "decimal" ||
				registeredOption.type == "integer"
			) {
				if (
					typeof value != "number" ||
					(registeredOption.type == "integer" && !Number.isInteger(value))
				) {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must be type "${registeredOption.type}"`,
					);
				}
				const { min, max, transform } = registeredOption.options;
				if (min !== undefined && value < min) {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must not be less than ${min}`,
					);
				}
				if (max !== undefined && value > max) {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must not be greater than ${min}`,
					);
				}
				if (transform) {
					values[index] = transform(value) as SystemConfigType[T];
				}
			}
			if (registeredOption.type == "boolean") {
				if (typeof value != "boolean") {
					throw new InvalidSystemConfigValueError(
						key,
						`Option must be type "boolean"`,
					);
				}
				const { transform } = registeredOption.options;
				if (transform) {
					values[index] = transform(value) as SystemConfigType[T];
				}
			}
		}

		const entries = values.map((val, ordinal) =>
			this.systemConfigRepository.create({
				key,
				ordinal,
				value_boolean: type === "boolean" ? (val as boolean) : null,
				value_int: type === "integer" ? (val as number) : null,
				value_string: type === "string" ? (val as string) : null,
				value_decimal: type === "decimal" ? (val as number) : null,
			}),
		);

		await this.systemConfigRepository.delete({ key });
		await this.systemConfigRepository.insert(entries);
	}

	async deleteOption(key: string): Promise<void> {
		if (!this.registeredOptions.has(key)) {
			throw new Error(`System Config option "${key}" is not registered`);
		}

		await this.systemConfigRepository.delete({ key });
	}

	isRegistered(key: string) {
		return this.registeredOptions.has(key);
	}

	getRegisteredOption(key: string) {
		return this.registeredOptions.get(
			key,
		) as AnyRegisteredSystemConfigOption | null;
	}
}
