// import { AttributeType } from "../enum/attribute-type.enum";

import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AttributeType } from "../enum/attribute-type.enum";
import { ResourceResponse } from "src/resource-manager/response/resource.response";
import { RelativeUrl } from "src/interception/relative-url";

export class BasePersistentAttributeResponse<T> {
	// @ApiProperty()
	// key: string;

	@ApiProperty({ enum: AttributeType })
	type: AttributeType;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	pluginId: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	sourceId: string | null;

	@ApiProperty({
		type: [String],
		nullable: true,
	})
	formatted: (string | RelativeUrl)[] | null;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	formatterPluginId: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	formatterSourceId: string | null;

	values: T[];
}

@ApiSchema({ name: "StringAttribute" })
export class PersistentStringAttributeResponse extends BasePersistentAttributeResponse<string> {
	@ApiProperty({ enum: [AttributeType.STRING] })
	override type = AttributeType.STRING;

	@ApiProperty({
		type: [String],
	})
	declare values: string[];
}

@ApiSchema({ name: "IntegerAttribute" })
export class PersistentIntegerAttributeResponse extends BasePersistentAttributeResponse<number> {
	@ApiProperty({ enum: [AttributeType.INTEGER] })
	override type = AttributeType.INTEGER;

	@ApiProperty({
		type: [Number],
	})
	declare values: number[];
}

@ApiSchema({ name: "DecimalAttribute" })
export class PersistentDecimalAttributeResponse extends BasePersistentAttributeResponse<number> {
	@ApiProperty({ enum: [AttributeType.DECIMAL] })
	override type = AttributeType.DECIMAL;

	@ApiProperty({
		type: [Number],
	})
	declare values: number[];
}

@ApiSchema({ name: "BooleanAttribute" })
export class PersistentBooleanAttributeResponse extends BasePersistentAttributeResponse<boolean> {
	@ApiProperty({ enum: [AttributeType.BOOLEAN] })
	override type = AttributeType.BOOLEAN;

	@ApiProperty({
		type: [Boolean],
	})
	declare values: boolean[];
}

@ApiSchema({ name: "BufferAttribute" })
export class PersistentBufferAttributeResponse extends BasePersistentAttributeResponse<ResourceResponse> {
	@ApiProperty({ enum: [AttributeType.BUFFER] })
	override type = AttributeType.BUFFER;

	@ApiProperty({
		type: [ResourceResponse],
	})
	declare values: ResourceResponse[];
}

export type PersistentAttributeResponse =
	| PersistentStringAttributeResponse
	| PersistentIntegerAttributeResponse
	| PersistentDecimalAttributeResponse
	| PersistentBooleanAttributeResponse
	| PersistentBufferAttributeResponse;
