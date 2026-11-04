import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { ConfigNodeType } from "../enum/config-node-type.enum";
import { HeadingConfigNodeSize } from "../enum/heading-config-node-size.enum";
import { ConfigSectionBackground } from "../enum/config-section-background.enum";

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
		type: String,
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

@ApiSchema({ name: "ParagraphConfigNode" })
export class ParagraphConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.PARAGRAPH] })
	type: ConfigNodeType.PARAGRAPH = ConfigNodeType.PARAGRAPH;

	@ApiProperty()
	content: string;
}

@ApiSchema({ name: "CheckboxConfigNode" })
export class CheckboxConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.CHECKBOX] })
	type: ConfigNodeType.CHECKBOX = ConfigNodeType.CHECKBOX;
	@ApiProperty()
	id: string;

	@ApiProperty()
	checked: boolean;

	@ApiProperty()
	readonly: boolean;
}

@ApiSchema({ name: "MarkdownConfigNode" })
export class MarkdownConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.MARKDOWN] })
	type: ConfigNodeType.MARKDOWN = ConfigNodeType.MARKDOWN;

	@ApiProperty()
	content: string;
}

@ApiSchema({ name: "ButtonConfigNode" })
export class ButtonConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.BUTTON] })
	type: ConfigNodeType.BUTTON = ConfigNodeType.BUTTON;

	@ApiProperty()
	id: string;

	@ApiProperty()
	content: string;
}

export const CONFIG_NODE_CHILD_SCHEMA = {
	oneOf: [
		{ $ref: getSchemaPath(TextConfigNodeResponse) },
		{ $ref: getSchemaPath(HeadingConfigNodeResponse) },
		{ $ref: getSchemaPath(CheckboxConfigNodeResponse) },
		{ $ref: getSchemaPath(ParagraphConfigNodeResponse) },
		{ $ref: getSchemaPath(MarkdownConfigNodeResponse) },
		{ $ref: getSchemaPath(ButtonConfigNodeResponse) },
		// must be string for recursion
		{ $ref: getSchemaPath("SectionConfigNode") },
		{ $ref: getSchemaPath("OrderableConfigNode") },
		{ $ref: getSchemaPath("SearchConfigNode") },
	],
};

@ApiSchema({ name: "SectionConfigNode" })
export class SectionConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.SECTION] })
	type: ConfigNodeType.SECTION = ConfigNodeType.SECTION;

	@ApiProperty({
		enum: ConfigSectionBackground,
		enumName: "SectionConfigNodeBackground",
	})
	background: ConfigSectionBackground;

	@ApiProperty()
	horizontal: boolean;

	@ApiProperty({
		type: "array",
		items: CONFIG_NODE_CHILD_SCHEMA,
	})
	children: BaseConfigNodeResponse[];
}

@ApiSchema({ name: "OrderableChildConfigNode" })
export class OrderableChildConfigNodeResponse {
	@ApiProperty({
		type: "string",
	})
	orderableId: string;

	@ApiProperty(CONFIG_NODE_CHILD_SCHEMA)
	child: BaseConfigNodeResponse;
}

@ApiSchema({ name: "OrderableConfigNode" })
@ApiExtraModels(OrderableChildConfigNodeResponse)
export class OrderableConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.ORDERABLE] })
	type: ConfigNodeType.ORDERABLE = ConfigNodeType.ORDERABLE;

	@ApiProperty()
	id: string;

	@ApiProperty({
		type: "array",
		items: {
			$ref: getSchemaPath(OrderableChildConfigNodeResponse),
		},
	})
	children: OrderableChildConfigNodeResponse[];
}

@ApiSchema({ name: "SearchConfigNode" })
export class SearchConfigNodeResponse extends BaseConfigNodeResponse {
	@ApiProperty({ enum: [ConfigNodeType.SEARCH] })
	type: ConfigNodeType.SEARCH = ConfigNodeType.SEARCH;

	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	value: string;

	@ApiProperty({
		nullable: true,
		type: String,
	})
	placeholder: string | null;

	@ApiProperty({
		...CONFIG_NODE_CHILD_SCHEMA,
		nullable: true,
	})
	results: ConfigNodeResponse | null;
}

export type ConfigNodeResponse =
	| TextConfigNodeResponse
	| HeadingConfigNodeResponse
	| SectionConfigNodeResponse
	| ParagraphConfigNodeResponse
	| CheckboxConfigNodeResponse
	| OrderableConfigNodeResponse
	| SearchConfigNodeResponse
	| MarkdownConfigNodeResponse
	| ButtonConfigNodeResponse;
