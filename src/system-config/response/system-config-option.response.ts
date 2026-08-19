import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { SystemConfigType } from "../enum/system-config-type.enum";

export class BaseSystemConfigOptionResponse {
	@ApiProperty({ enum: SystemConfigType })
	type: SystemConfigType;

	@ApiProperty()
	key: string;

	@ApiProperty()
	supportsMultiple: boolean;
}

@ApiSchema({ name: "StringSystemConfigOption" })
export class StringSystemConfigOptionResponse extends BaseSystemConfigOptionResponse {
	@ApiProperty({ enum: [SystemConfigType.STRING] })
	override type = SystemConfigType.STRING;

	@ApiProperty({
		type: [String],
	})
	values: string[];

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	minLength: number | null;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	maxLength: number | null;
}

@ApiSchema({ name: "IntegerSystemConfigOption" })
export class IntegerSystemConfigOptionResponse extends BaseSystemConfigOptionResponse {
	@ApiProperty({ enum: [SystemConfigType.INTEGER] })
	override type = SystemConfigType.INTEGER;

	@ApiProperty({
		type: "integer",
		isArray: true,
	})
	values: number[];

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	min: number | null;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	max: number | null;
}

@ApiSchema({ name: "DecimalSystemConfigOption" })
export class DecimalSystemConfigOptionResponse extends BaseSystemConfigOptionResponse {
	@ApiProperty({ enum: [SystemConfigType.DECIMAL] })
	override type = SystemConfigType.DECIMAL;

	@ApiProperty({
		type: "number",
		isArray: true,
	})
	values: number[];

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	min: number | null;

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	max: number | null;
}

@ApiSchema({ name: "BooleanSystemConfigOption" })
export class BooleanSystemConfigOptionResponse extends BaseSystemConfigOptionResponse {
	@ApiProperty({ enum: [SystemConfigType.BOOLEAN] })
	override type = SystemConfigType.BOOLEAN;

	@ApiProperty({
		type: "boolean",
		isArray: true,
	})
	values: boolean[];
}

export type SystemConfigOptionResponse =
	| StringSystemConfigOptionResponse
	| IntegerSystemConfigOptionResponse
	| DecimalSystemConfigOptionResponse
	| BooleanSystemConfigOptionResponse;
