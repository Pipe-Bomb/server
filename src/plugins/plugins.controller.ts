import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Privileges } from "src/privileges/privileges.decorator";
import { PrivilegesService } from "src/privileges/privileges.service";
import { InstallPluginDto } from "./dto/install-plugin.dto";
import { PluginsService } from "./plugins.service";
import { LoadedPlugin } from "./interface/loaded-plugin.interface";
import { LoadedPluginResponse } from "./response/loaded-plugin.response";

@Controller("plugins")
export class PluginsController {
	constructor(
		private readonly pluginsService: PluginsService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(
			null,
			"modify-plugin-installations",
		);
		this.privilegesService.registerPrivilege(null, "view-plugins", [
			"modify-plugin-installations",
		]);
	}

	private toResponse(plugin: LoadedPlugin): LoadedPluginResponse {
		return {
			name: plugin.package.name,
			version: plugin.package.version,
			description: plugin.package.description || null,
		};
	}

	@Get()
	@ApiOperation({ operationId: "getInstalledPlugins" })
	@ApiOkResponse({
		type: [LoadedPluginResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@Privileges("view-plugins")
	getInstalledPlugins(): LoadedPluginResponse[] {
		const plugins = this.pluginsService.all();
		return plugins.map(this.toResponse);
	}

	@Post("install")
	@ApiOperation({ operationId: "installPlugin" })
	@ApiCreatedResponse({ type: [LoadedPluginResponse] })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.CREATED)
	@Privileges("install-plugins")
	async install(
		@Body() dto: InstallPluginDto,
	): Promise<LoadedPluginResponse[]> {
		try {
			await this.pluginsService.installPlugin(dto.url, dto.ref);
			return this.getInstalledPlugins();
		} catch (e) {
			if (e instanceof BadRequestException) {
				throw e;
			}
			throw new BadRequestException(
				`Installation failed: ${(e as Error).message}`,
			);
		}
	}

	@Delete(":name")
	@ApiOperation({ operationId: "removePlugin" })
	@ApiOkResponse({ type: [LoadedPluginResponse] })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.OK)
	@Privileges("modify-plugin-installations")
	async remove(@Param("name") name: string): Promise<LoadedPluginResponse[]> {
		const found = await this.pluginsService.removePlugin(name);
		if (!found) {
			throw new NotFoundException(`Plugin "${name}" is not installed`);
		}
		return this.getInstalledPlugins();
	}
}
