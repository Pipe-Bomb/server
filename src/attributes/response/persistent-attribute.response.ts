// import { AttributeType } from "../enum/attribute-type.enum";

import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AttributeType } from "../enum/attribute-type.enum";
import { ResourceResponse } from "src/resources/response/resource.response";

export class BasePersistentAttributeResponse {
	// @ApiProperty()
	// key: string;

	@ApiProperty({ enum: AttributeType })
	type: AttributeType;
}

@ApiSchema({ name: "StringAttribute" })
export class PersistentStringAttributeResponse extends BasePersistentAttributeResponse {
	@ApiProperty({ enum: [AttributeType.STRING] })
	declare type: AttributeType.STRING;

	@ApiProperty({
		type: [String],
	})
	values: string[];
}

@ApiSchema({ name: "IntegerAttribute" })
export class PersistentIntegerAttributeResponse extends BasePersistentAttributeResponse {
	@ApiProperty({ enum: [AttributeType.INTEGER] })
	declare type: AttributeType.INTEGER;

	@ApiProperty({
		type: [Number],
	})
	values: number[];
}

@ApiSchema({ name: "DecimalAttribute" })
export class PersistentDecimalAttributeResponse extends BasePersistentAttributeResponse {
	@ApiProperty({ enum: [AttributeType.DECIMAL] })
	declare type: AttributeType.DECIMAL;

	@ApiProperty({
		type: [Number],
	})
	values: number[];
}

@ApiSchema({ name: "BooleanAttribute" })
export class PersistentBooleanAttributeResponse extends BasePersistentAttributeResponse {
	@ApiProperty({ enum: [AttributeType.BOOLEAN] })
	declare type: AttributeType.BOOLEAN;

	@ApiProperty({
		type: [Boolean],
	})
	values: boolean[];
}

@ApiSchema({ name: "BufferAttribute" })
export class PersistentBufferAttributeResponse extends BasePersistentAttributeResponse {
	@ApiProperty({ enum: [AttributeType.BUFFER] })
	declare type: AttributeType.BUFFER;

	@ApiProperty({
		type: [ResourceResponse],
	})
	values: ResourceResponse[];
}

export type PersistentAttributeResponse =
	| PersistentStringAttributeResponse
	| PersistentIntegerAttributeResponse
	| PersistentDecimalAttributeResponse
	| PersistentBooleanAttributeResponse
	| PersistentBufferAttributeResponse;
