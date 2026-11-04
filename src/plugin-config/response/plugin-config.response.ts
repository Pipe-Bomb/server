import { ApiExtraModels, ApiSchema, ApiProperty } from "@nestjs/swagger";
import {
	TextConfigNodeResponse,
	HeadingConfigNodeResponse,
	SectionConfigNodeResponse,
	ParagraphConfigNodeResponse,
	CONFIG_NODE_CHILD_SCHEMA,
	CheckboxConfigNodeResponse,
	OrderableConfigNodeResponse,
	SearchConfigNodeResponse,
	MarkdownConfigNodeResponse,
	ButtonConfigNodeResponse,
} from "./config-node.response";
import type { ConfigNodeResponse } from "./config-node.response";

@ApiExtraModels(
	TextConfigNodeResponse,
	HeadingConfigNodeResponse,
	SectionConfigNodeResponse,
	ParagraphConfigNodeResponse,
	CheckboxConfigNodeResponse,
	OrderableConfigNodeResponse,
	SearchConfigNodeResponse,
	MarkdownConfigNodeResponse,
	ButtonConfigNodeResponse,
)
@ApiSchema({ name: "PluginConfig" })
export class PluginConfigResponse {
	@ApiProperty(CONFIG_NODE_CHILD_SCHEMA)
	node: ConfigNodeResponse;
}
