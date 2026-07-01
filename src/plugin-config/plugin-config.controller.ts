import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { PluginConfigService } from "./plugin-config.service";
import {
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { PluginConfigsResponse } from "./response/plugin-configs.response";
import { ConfigNodeResponse } from "./response/config-node.response";
import { PluginConfigResponse } from "./response/plugin-config.response";
import { ConfigNode, HeadingConfigNode } from "@sdk";
import { ConfigNodeType } from "./enum/config-node-type.enum";
import { HeadingConfigNodeSize } from "./enum/heading-config-node-size.enum";
import { PluginConfigUpdateDto } from "./dto/plugin-config-update.dto";
import { AuthGuard } from "src/users/auth.guard";
import { FetchUserPipe } from "src/users/user.pipe";
import { ReqUser } from "src/users/user.decorator";
import { DBUser } from "src/users/entity/user.entity";
import { UserConfigsResponse } from "./response/user-configs.response";

@Controller("plugin-config")
export class PluginConfigController {
	constructor(private readonly pluginConfigService: PluginConfigService) {}

	@Get("plugin")
	@ApiOperation({ operationId: "getAllPluginConfigs" })
	@ApiOkResponse({
		type: PluginConfigsResponse,
	})
	getAllPluginConfigs(): PluginConfigsResponse {
		const all = this.pluginConfigService.allPluginConfigs();

		return {
			configs: all.map((configManager) => ({
				id: configManager.plugin.package.name,
			})),
		};
	}

	@Get("user")
	@UseGuards(AuthGuard)
	@ApiOperation({ operationId: "getAllUserConfigs" })
	@ApiOkResponse({
		type: UserConfigsResponse,
	})
	getAllUserConfigs(@ReqUser(FetchUserPipe) user: DBUser): UserConfigsResponse {
		const all = this.pluginConfigService
			.allUserConfigs()
			.filter(({ configManager }) => configManager.canUserAccess(user.uuid));

		return {
			configs: all.map(({ plugin, id }) => ({
				pluginId: plugin.package.name,
				configId: id,
			})),
		};
	}

	@Get("plugin/:pluginId")
	@ApiOperation({ operationId: "getPluginConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@UseGuards(AuthGuard)
	async getPluginConfig(
		@Param("pluginId") pluginId: string,
	): Promise<PluginConfigResponse> {
		const config = this.pluginConfigService.findPluginConfig(pluginId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}

		const rootNode = await config.configManager.getConfigOptions();

		return {
			node: this.toResponse(rootNode),
		};
	}

	@Get("user/:pluginId/:configId")
	@ApiOperation({ operationId: "getUserConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@ApiForbiddenResponse()
	@UseGuards(AuthGuard)
	async getUserConfig(
		@Param("pluginId") pluginId: string,
		@Param("configId") configId: string,
		@ReqUser(FetchUserPipe) user: DBUser,
	): Promise<PluginConfigResponse> {
		const config = this.pluginConfigService.findUserConfig(pluginId, configId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}
		const { configManager } = config;
		if (!configManager.canUserAccess(user.uuid)) {
			throw new ForbiddenException();
		}

		const rootNode = await config.configManager.getConfigOptions(user.uuid);
		if (!rootNode) {
			throw new ForbiddenException();
		}

		return {
			node: this.toResponse(rootNode),
		};
	}

	@Post("plugin/:pluginId")
	@ApiOperation({ operationId: "updatePluginConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	async updatePluginConfig(
		@Param("pluginId") pluginId: string,
		@Body() dto: PluginConfigUpdateDto,
	): Promise<PluginConfigResponse> {
		const config = this.pluginConfigService.findPluginConfig(pluginId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}

		const rootNode = await config.configManager.update(dto.values);

		return {
			node: this.toResponse(rootNode),
		};
	}

	@Post("user/:pluginId/:configId")
	@ApiOperation({ operationId: "updateUserConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	async updateUserConfig(
		@Param("pluginId") pluginId: string,
		@Param("configId") configId: string,
		@ReqUser(FetchUserPipe) user: DBUser,
		@Body() dto: PluginConfigUpdateDto,
	) {
		const config = this.pluginConfigService.findUserConfig(pluginId, configId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}
		const { configManager } = config;
		if (!configManager.canUserAccess(user.uuid)) {
			throw new ForbiddenException();
		}

		const rootNode = await config.configManager.update(user.uuid, dto.values);
		if (!rootNode) {
			throw new ForbiddenException();
		}

		return {
			node: this.toResponse(rootNode),
		};
	}

	private toResponse(node: ConfigNode): ConfigNodeResponse {
		switch (node.type) {
			case "heading":
				return {
					type: ConfigNodeType.HEADING,

					size: (
						{
							sm: HeadingConfigNodeSize.SM,
							md: HeadingConfigNodeSize.MD,
							lg: HeadingConfigNodeSize.LG,
						} as Record<HeadingConfigNode["size"], HeadingConfigNodeSize>
					)[node.size],
					content: node.content,
				};
			case "text":
				return {
					type: ConfigNodeType.TEXT,
					id: node.id,
					name: node.name,
					value: node.value,
					placeholder: node.placeholder ?? null,
				};
			case "section":
				return {
					type: ConfigNodeType.SECTION,
					children: node.children.map((child) => this.toResponse(child)),
				};
		}
	}
}
