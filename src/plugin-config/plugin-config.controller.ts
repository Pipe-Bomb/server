import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PluginConfigService } from "./plugin-config.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { PluginConfigsResponse } from "./response/plugin-configs.response";
import { ConfigNodeResponse } from "./response/config-node.response";
import { PluginConfigResponse } from "./response/plugin-config.response";
import { ConfigNode, HeadingConfigNode } from "@sdk";
import { ConfigNodeType } from "./enum/config-node-type.enum";
import { HeadingConfigNodeSize } from "./enum/heading-config-node-size.enum";

@Controller("plugin-config")
export class PluginConfigController {
	constructor(private readonly pluginConfigService: PluginConfigService) {}

	@Get()
	@ApiOperation({ operationId: "getAllPluginConfigs" })
	@ApiOkResponse({
		type: PluginConfigsResponse,
	})
	getAll(): PluginConfigsResponse {
		const all = this.pluginConfigService.all();

		return {
			configs: all.map((configManager) => ({
				id: configManager.plugin.package.name,
			})),
		};
	}

	@Get(":pluginId")
	get(@Param("pluginId") pluginId: string): PluginConfigResponse {
		const config = this.pluginConfigService.find(pluginId);
		if (!config) {
			throw new NotFoundException("Config not found");
		}

		const rootNode = config.configManager.getConfigOptions();

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
					name: node.id,
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
