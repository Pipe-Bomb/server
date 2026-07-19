import {
	ApiExtraModels,
	ApiSchema,
	ApiProperty,
	getSchemaPath,
} from "@nestjs/swagger";
import {
	TextConfigNodeResponse,
	HeadingConfigNodeResponse,
	SectionConfigNodeResponse,
	ParagraphConfigNodeResponse,
} from "./config-node.response";

@ApiExtraModels(
	TextConfigNodeResponse,
	HeadingConfigNodeResponse,
	SectionConfigNodeResponse,
	ParagraphConfigNodeResponse,
)
@ApiSchema({ name: "PluginConfig" })
export class PluginConfigResponse {
	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(TextConfigNodeResponse) },
			{ $ref: getSchemaPath(HeadingConfigNodeResponse) },
			{ $ref: getSchemaPath(SectionConfigNodeResponse) },
			{ $ref: getSchemaPath(ParagraphConfigNodeResponse) },
		],
	})
	node:
		| TextConfigNodeResponse
		| HeadingConfigNodeResponse
		| SectionConfigNodeResponse
		| ParagraphConfigNodeResponse;
}
