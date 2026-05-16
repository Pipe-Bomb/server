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
} from "./config-node.response";

@ApiExtraModels(
	TextConfigNodeResponse,
	HeadingConfigNodeResponse,
	SectionConfigNodeResponse,
)
@ApiSchema({ name: "PluginConfig" })
export class PluginConfigResponse {
	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(TextConfigNodeResponse) },
			{ $ref: getSchemaPath(HeadingConfigNodeResponse) },
			{ $ref: getSchemaPath(SectionConfigNodeResponse) },
		],
	})
	node:
		| TextConfigNodeResponse
		| HeadingConfigNodeResponse
		| SectionConfigNodeResponse;
}
