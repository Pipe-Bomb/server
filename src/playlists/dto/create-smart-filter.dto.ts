import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from "class-validator";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

export abstract class BaseSmartFilterDto {
	@ApiProperty({
		enum: AttributeEntity,
	})
	@IsEnum(AttributeEntity)
	entityType: AttributeEntity;

	@ApiProperty({
		enum: AttributeType,
	})
	@IsEnum(AttributeType)
	attributeType: AttributeType;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	attributeKey: string;

	@ApiProperty()
	@IsOptional()
	@IsBoolean()
	inverse?: boolean;
}

export class StringSmartFilterDto extends BaseSmartFilterDto {
	@ApiProperty({ enum: [AttributeType.STRING] })
	override attributeType: AttributeType.STRING = AttributeType.STRING;

	@ApiPropertyOptional({
		type: "string",
	})
	@IsOptional()
	@IsString()
	value?: string;

	@ApiPropertyOptional({
		type: "boolean",
	})
	@IsOptional()
	@IsBoolean()
	partial?: boolean;
}

export class BooleanSmartFilterDto extends BaseSmartFilterDto {
	@ApiProperty({ enum: [AttributeType.BOOLEAN] })
	override attributeType: AttributeType.BOOLEAN = AttributeType.BOOLEAN;

	@ApiPropertyOptional({
		type: "boolean",
	})
	@IsOptional()
	@IsBoolean()
	value?: boolean;
}

export class IntegerSmartFilterDto extends BaseSmartFilterDto {
	@ApiProperty({ enum: [AttributeType.INTEGER] })
	override attributeType: AttributeType.INTEGER = AttributeType.INTEGER;

	@ApiPropertyOptional({
		type: "integer",
	})
	@IsInt()
	@IsOptional()
	value?: number;

	@ApiPropertyOptional({
		type: "integer",
	})
	@IsInt()
	@IsOptional()
	min?: number;

	@ApiPropertyOptional({
		type: "integer",
	})
	@IsInt()
	@IsOptional()
	max?: number;
}

export class DecimalSmartFilterDto extends BaseSmartFilterDto {
	@ApiProperty({ enum: [AttributeType.DECIMAL] })
	override attributeType: AttributeType.DECIMAL = AttributeType.DECIMAL;

	@ApiPropertyOptional({
		type: "number",
	})
	@IsNumber()
	@IsOptional()
	value?: number;

	@ApiPropertyOptional({
		type: "number",
	})
	@IsNumber()
	@IsOptional()
	min?: number;

	@ApiPropertyOptional({
		type: "number",
	})
	@IsNumber()
	@IsOptional()
	max?: number;
}

export class BufferSmartFilterDto extends BaseSmartFilterDto {
	@ApiProperty({ enum: [AttributeType.BUFFER] })
	override attributeType: AttributeType.BUFFER = AttributeType.BUFFER;
}

export type SmartFilterDto =
	| StringSmartFilterDto
	| BooleanSmartFilterDto
	| IntegerSmartFilterDto
	| DecimalSmartFilterDto
	| BufferSmartFilterDto;
