import { ApiProperty, ApiSchema, getSchemaPath } from "@nestjs/swagger";
import { ConfigNodeType } from "../enum/config-node-type.enum";
import { HeadingConfigNodeSize } from "../enum/heading-config-node-size.enum";

export class BaseConfigNodeResponse {
	@ApiProperty({ enum: ConfigNodeType })
	type: ConfigNodeType;
}

@ApiSchema({ name: "TextConfigNode" })
export class TextConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.TEXT] })
	type: ConfigNodeType.TEXT = ConfigNodeType.TEXT;

	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	value: string;

	@ApiProperty({
		nullable: true,
		required: false,
		type: String,
		default: null,
	})
	placeholder: string | null;
}

@ApiSchema({ name: "HeadingConfigNode" })
export class HeadingConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.HEADING] })
	type: ConfigNodeType.HEADING = ConfigNodeType.HEADING;

	@ApiProperty({ enum: HeadingConfigNodeSize })
	size: HeadingConfigNodeSize;

	@ApiProperty()
	content: string;
}

@ApiSchema({ name: "SectionConfigNode" })
export class SectionConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.SECTION] })
	type: ConfigNodeType.SECTION = ConfigNodeType.SECTION;

	@ApiProperty({
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(TextConfigNodeResponse) },
				{ $ref: getSchemaPath(HeadingConfigNodeResponse) },
				{ $ref: getSchemaPath("SectionConfigNode") }, // must be string for recursion
			],
		},
	})
	children: BaseConfigNodeResponse[];
}

export type ConfigNodeResponse =
	| TextConfigNodeResponse
	| HeadingConfigNodeResponse
	| SectionConfigNodeResponse;
