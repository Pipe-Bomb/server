import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsString,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SystemConfigType } from "../enum/system-config-type.enum";

export abstract class BaseUpdateSystemConfigOptionDto {
	@ApiProperty({
		enum: SystemConfigType,
	})
	@IsEnum(SystemConfigType)
	type: SystemConfigType;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	key: string;
}

export class StringUpdateSystemConfigOptionDto extends BaseUpdateSystemConfigOptionDto {
	@ApiProperty({ enum: [SystemConfigType.STRING] })
	override type: SystemConfigType.STRING = SystemConfigType.STRING;

	@IsArray()
	@IsString({
		each: true,
	})
	@ApiProperty()
	values: string[];
}

export class BooleanUpdateSystemConfigOptionDto extends BaseUpdateSystemConfigOptionDto {
	@ApiProperty({ enum: [SystemConfigType.BOOLEAN] })
	override type: SystemConfigType.BOOLEAN = SystemConfigType.BOOLEAN;

	@IsArray()
	@IsBoolean({
		each: true,
	})
	@ApiProperty({
		type: [Boolean],
	})
	values: boolean[];
}

export class IntegerUpdateSystemConfigOptionDto extends BaseUpdateSystemConfigOptionDto {
	@ApiProperty({ enum: [SystemConfigType.INTEGER] })
	override type: SystemConfigType.INTEGER = SystemConfigType.INTEGER;

	@IsArray()
	@IsInt({
		each: true,
	})
	@ApiProperty({
		type: "integer",
		isArray: true,
	})
	values: number[];
}

export class DecimalUpdateSystemConfigOptionDto extends BaseUpdateSystemConfigOptionDto {
	@ApiProperty({ enum: [SystemConfigType.DECIMAL] })
	override type: SystemConfigType.DECIMAL = SystemConfigType.DECIMAL;

	@IsArray()
	@IsNumber(
		{},
		{
			each: true,
		},
	)
	@ApiProperty({
		type: "number",
		isArray: true,
	})
	values: number[];
}

export type UpdateSystemConfigOptionDto =
	| StringUpdateSystemConfigOptionDto
	| BooleanUpdateSystemConfigOptionDto
	| IntegerUpdateSystemConfigOptionDto
	| DecimalUpdateSystemConfigOptionDto;
