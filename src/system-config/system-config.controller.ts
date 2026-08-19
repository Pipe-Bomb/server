import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
} from "@nestjs/common";
import { SystemConfigService } from "./system-config.service";
import { SystemConfigKeysDto } from "./dto/system-config-keys.dto";
import { SystemConfigOptionResponse } from "./response/system-config-option.response";
import { SystemConfigType } from "./enum/system-config-type.enum";
import { SystemConfigOptionsResponse } from "./response/system-config-options.response";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { UpdateSystemConfigOptionsDto } from "./dto/update-system-config-options.dto";
import { Privileges } from "src/privileges/privileges.decorator";
import { PrivilegesService } from "src/privileges/privileges.service";
import { SystemConfigValue } from "./interface/system-config-value.interface";

@Controller("system-config")
export class SystemConfigController {
	constructor(
		private readonly systemConfigService: SystemConfigService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(null, "edit-system-config");
		this.privilegesService.registerPrivilege(null, "view-system-config", [
			"edit-system-config",
		]);
	}

	@Post()
	@ApiOperation({ operationId: "getSystemConfigOptions" })
	@ApiOkResponse({
		type: SystemConfigOptionsResponse,
	})
	@HttpCode(HttpStatus.OK)
	@Privileges("view-system-config")
	async getOptions(
		@Body() dto: SystemConfigKeysDto,
	): Promise<SystemConfigOptionsResponse> {
		for (const key of dto.keys) {
			if (!this.systemConfigService.isRegistered(key)) {
				throw new BadRequestException(`Key "${key}" is not a valid option`);
			}
		}

		const configValues = await this.systemConfigService.getOptions(dto.keys);
		return {
			options: this.toResponse(configValues),
		};
	}

	@Patch()
	@ApiOperation({ operationId: "updateSystemConfigOptions" })
	@ApiOkResponse({
		type: SystemConfigOptionsResponse,
	})
	@HttpCode(HttpStatus.OK)
	@Privileges("edit-system-config")
	async updateOptions(
		@Body() dto: UpdateSystemConfigOptionsDto,
	): Promise<SystemConfigOptionsResponse> {
		const keys = new Set<string>();
		for (const option of dto.options) {
			if (keys.has(option.key)) {
				throw new BadRequestException(`Duplicate key "${option.key}"`);
			}
			keys.add(option.key);
		}
		await this.systemConfigService.updateOptions(dto.options);
		const configValues = await this.systemConfigService.getOptions(
			Array.from(keys),
		);
		return {
			options: this.toResponse(configValues),
		};
	}

	private toResponse(
		values: SystemConfigValue[],
	): SystemConfigOptionResponse[] {
		return values.map((item) => {
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
	}
}
