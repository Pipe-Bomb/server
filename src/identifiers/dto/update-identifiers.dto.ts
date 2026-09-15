import { ApiProperty } from "@nestjs/swagger";
import { IdentifierKeyDto } from "./identifier-key.dto";
import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UpdateIdentifiersDto {
	@ApiProperty({ type: [IdentifierKeyDto], required: false, default: [] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IdentifierKeyDto)
	enable: IdentifierKeyDto[] = [];

	@ApiProperty({ type: [IdentifierKeyDto], required: false, default: [] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IdentifierKeyDto)
	disable: IdentifierKeyDto[] = [];
}
