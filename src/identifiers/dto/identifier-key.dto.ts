import { ApiProperty } from "@nestjs/swagger";
import { IdentifierType } from "../enum/identifier-type.enum";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class IdentifierKeyDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	pluginId: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	identifierId: string;

	@ApiProperty({ enum: IdentifierType, enumName: "IdentifierType" })
	@IsEnum(IdentifierType)
	type: IdentifierType;
}
