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
	ServiceUnavailableException,
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
import { FetchUserPipe } from "src/users/user.pipe";
import { ReqUser } from "src/users/user.decorator";
import { DBUser } from "src/users/entity/user.entity";
import { UserConfigsResponse } from "./response/user-configs.response";
import { Privileges } from "src/privileges/privileges.decorator";
import { PrivilegesService } from "src/privileges/privileges.service";
import { PluginConfigSearchDto } from "./dto/plugin-config-search.dto";
import { ConfigSectionBackground } from "./enum/config-section-background.enum";
import { PluginConfigButtonDto } from "./dto/plugin-config-button.dto";

@Controller("plugin-config")
export class PluginConfigController {
	constructor(
		private readonly pluginConfigService: PluginConfigService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(null, "view-plugin-configs");
		this.privilegesService.registerPrivilege(null, "edit-plugin-configs");
	}

	@Get("plugin")
	@Privileges("view-plugin-configs")
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
	@Privileges("view-plugin-configs")
	@ApiOperation({ operationId: "getPluginConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
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
	@Privileges("edit_plugin_configs")
	@ApiOperation({ operationId: "updatePluginConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@HttpCode(HttpStatus.OK)
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

	@Post("plugin/:pluginId/search")
	@ApiOperation({ operationId: "searchPluginConfig" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@ApiForbiddenResponse()
	@Privileges("edit_plugin_configs")
	@HttpCode(HttpStatus.OK)
	async searchPluginConfig(
		@Param("pluginId") pluginId: string,
		@Body() dto: PluginConfigSearchDto,
	): Promise<PluginConfigResponse> {
		const config = this.pluginConfigService.findPluginConfig(pluginId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}

		if (!config.configManager.search) {
			throw new ServiceUnavailableException("Config doesn't implement search");
		}

		const results = await config.configManager.search(dto.id, dto.query);
		return {
			node: this.toResponse(results),
		};
	}

	@Post("plugin/:pluginId/button")
	@ApiOperation({ operationId: "activatePluginConfigButton" })
	@ApiOkResponse({
		type: PluginConfigResponse,
	})
	@ApiNotFoundResponse()
	@ApiForbiddenResponse()
	@Privileges("edit_plugin_configs")
	@HttpCode(HttpStatus.OK)
	async activatePluginConfigButton(
		@Param("pluginId") pluginId: string,
		@Body() dto: PluginConfigButtonDto,
	): Promise<PluginConfigResponse> {
		const config = this.pluginConfigService.findPluginConfig(pluginId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}

		if (!config.configManager.onButtonPress) {
			throw new ServiceUnavailableException("Config doesn't implement buttons");
		}

		const results = await config.configManager.onButtonPress(dto.id);
		return {
			node: this.toResponse(results),
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
					horizontal: !!node.horizontal,
					background: (() => {
						switch (node.background) {
							case "surface":
								return ConfigSectionBackground.SURFACE;
							case "warning":
								return ConfigSectionBackground.WARNING;
							default:
								return ConfigSectionBackground.NONE;
						}
					})(),
					children: node.children.map((child) => this.toResponse(child)),
				};
			case "paragraph":
				return {
					type: ConfigNodeType.PARAGRAPH,
					content: node.content,
				};
			case "checkbox":
				return {
					type: ConfigNodeType.CHECKBOX,
					id: node.id,
					checked: node.checked,
					readonly: !!node.readonly,
				};
			case "orderable":
				return {
					type: ConfigNodeType.ORDERABLE,
					id: node.id,
					children: node.children.map(({ orderableId, ...child }) => ({
						orderableId,
						child: this.toResponse(child),
					})),
				};
			case "search":
				return {
					type: ConfigNodeType.SEARCH,
					id: node.id,
					name: node.name,
					value: node.value,
					placeholder: node.placeholder ?? null,
					results: node.results ? this.toResponse(node.results) : null,
				};
			case "markdown":
				return {
					type: ConfigNodeType.MARKDOWN,
					content: node.content,
				};
			case "button":
				return {
					type: ConfigNodeType.BUTTON,
					id: node.id,
					content: node.content,
				};
		}
	}
}
