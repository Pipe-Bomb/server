import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsString,
} from "class-validator";
import { AttributeType } from "../enum/attribute-type.enum";
import { ApiProperty } from "@nestjs/swagger";

export abstract class BaseCustomAttributeDto {
	@ApiProperty({
		enum: AttributeType,
	})
	@IsEnum(AttributeType)
	type: AttributeType;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	key: string;
}

export class CustomStringAttributeDto extends BaseCustomAttributeDto {
	@ApiProperty({ enum: [AttributeType.STRING] })
	override type: AttributeType.STRING = AttributeType.STRING;

	@IsString()
	@ApiProperty()
	value: string;
}

export class CustomBooleanAttributeDto extends BaseCustomAttributeDto {
	@ApiProperty({ enum: [AttributeType.BOOLEAN] })
	override type: AttributeType.BOOLEAN = AttributeType.BOOLEAN;

	@IsBoolean()
	@ApiProperty()
	value: boolean;
}

export class CustomIntegerAttributeDto extends BaseCustomAttributeDto {
	@ApiProperty({ enum: [AttributeType.INTEGER] })
	override type: AttributeType.INTEGER = AttributeType.INTEGER;

	@IsInt()
	@ApiProperty({
		type: "integer",
	})
	value: number;
}

export class CustomDecimalAttributeDto extends BaseCustomAttributeDto {
	@ApiProperty({ enum: [AttributeType.DECIMAL] })
	override type: AttributeType.DECIMAL = AttributeType.DECIMAL;

	@IsNumber()
	@ApiProperty()
	value: number;
}

export class CustomBufferAttributeDto extends BaseCustomAttributeDto {
	@ApiProperty({ enum: [AttributeType.BUFFER] })
	override type: AttributeType.BUFFER = AttributeType.BUFFER;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	extension: string;

	value: Buffer;
}

export type ContainedCustomAttributeDto =
	| CustomStringAttributeDto
	| CustomBooleanAttributeDto
	| CustomIntegerAttributeDto
	| CustomDecimalAttributeDto;

export type CustomAttributeDto =
	| ContainedCustomAttributeDto
	| CustomBufferAttributeDto;
