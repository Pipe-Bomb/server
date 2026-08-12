import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { SystemConfigService } from "./system-config.service";
import { SystemConfigKeysDto } from "./dto/system-config-keys.dto";
import { SystemConfigOptionResponse } from "./response/system-config-option.response";
import { SystemConfigType } from "./enum/system-config-type.enum";
import { SystemConfigOptionsResponse } from "./response/system-config-options.response";

@Controller("system-config")
export class SystemConfigController {
	constructor(private readonly systemConfigService: SystemConfigService) {}

	@Post()
	async getOptions(
		@Body() dto: SystemConfigKeysDto,
	): Promise<SystemConfigOptionsResponse> {
		for (const key of dto.keys) {
			if (!this.systemConfigService.isRegistered(key)) {
				throw new BadRequestException(`Key "${key}" is not a valid option`);
			}
		}

		const configValues = await this.systemConfigService.getOptions(dto.keys);

		const options: SystemConfigOptionResponse[] = configValues.map((item) => {
			const registeredOption = this.systemConfigService.getRegisteredOption(
				item.key,
			);

			switch (item.type) {
				case SystemConfigType.STRING: {
					const opts =
						registeredOption?.type === "string"
							? registeredOption.options
							: undefined;

					return {
						type: SystemConfigType.STRING,
						key: item.key,
						supportsMultiple: item.supportsMultiple,
						values: item.value as string[],
						minLength: opts?.minLength ?? null,
						maxLength: opts?.maxLength ?? null,
					};
				}
				case SystemConfigType.INTEGER: {
					const opts =
						registeredOption?.type === "integer"
							? registeredOption.options
							: undefined;

					return {
						type: SystemConfigType.INTEGER,
						key: item.key,
						supportsMultiple: item.supportsMultiple,
						values: item.value as number[],
						min: opts?.min ?? null,
						max: opts?.max ?? null,
					};
				}
				case SystemConfigType.DECIMAL: {
					const opts =
						registeredOption?.type === "decimal"
							? registeredOption.options
							: undefined;

					return {
						type: SystemConfigType.DECIMAL,
						key: item.key,
						supportsMultiple: item.supportsMultiple,
						values: item.value as number[],
						min: opts?.min ?? null,
						max: opts?.max ?? null,
					};
				}
				case SystemConfigType.BOOLEAN: {
					return {
						type: SystemConfigType.BOOLEAN,
						key: item.key,
						supportsMultiple: item.supportsMultiple,
						values: item.value as boolean[],
					};
				}
				default:
					throw new Error(`Unknown config type "${item.type}"`);
			}
		});

		return { options };
	}
}
