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

export abstract class BaseSearchAttributeDto {
	@ApiProperty({
		enum: AttributeEntity,
	})
	@IsEnum(AttributeEntity)
	entityType: AttributeEntity;

	@ApiProperty({
		enum: AttributeType,
	})
	@IsEnum(AttributeType)
	type: AttributeType;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	key: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	exists?: boolean;
}

export class StringSearchAttributeDto extends BaseSearchAttributeDto {
	@ApiProperty({ enum: [AttributeType.STRING] })
	override type = AttributeType.STRING;

	@ApiPropertyOptional({
		type: "string",
	})
	@IsOptional()
	@IsString()
	query?: string;

	@ApiPropertyOptional({
		type: "boolean",
	})
	@IsOptional()
	@IsBoolean()
	partial?: boolean;
}

export class BooleanSearchAttributeDto extends BaseSearchAttributeDto {
	@ApiProperty({ enum: [AttributeType.BOOLEAN] })
	override type = AttributeType.BOOLEAN;

	@ApiPropertyOptional({
		type: "boolean",
	})
	@IsOptional()
	@IsBoolean()
	boolean?: boolean;
}

export class IntegerSearchAttributeDto extends BaseSearchAttributeDto {
	@ApiProperty({ enum: [AttributeType.INTEGER] })
	override type = AttributeType.INTEGER;

	@ApiPropertyOptional({
		type: "integer",
	})
	@IsInt()
	@IsOptional()
	integer?: number;

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

export class DecimalSearchAttributeDto extends BaseSearchAttributeDto {
	@ApiProperty({ enum: [AttributeType.DECIMAL] })
	override type = AttributeType.DECIMAL;

	@ApiPropertyOptional({
		type: "number",
	})
	@IsNumber()
	@IsOptional()
	decimal?: number;

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

export class BufferSearchAttributeDto extends BaseSearchAttributeDto {
	@ApiProperty({ enum: [AttributeType.BUFFER] })
	override type = AttributeType.BUFFER;

	@ApiProperty()
	@IsBoolean()
	declare exists: boolean;
}

export type SearchAttributeDto =
	| StringSearchAttributeDto
	| BooleanSearchAttributeDto
	| IntegerSearchAttributeDto
	| DecimalSearchAttributeDto
	| BufferSearchAttributeDto;
