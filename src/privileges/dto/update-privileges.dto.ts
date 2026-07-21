import { Type } from "class-transformer";
import { UpdatePrivilegeDto } from "./update-privilege.dto";
import { IsArray, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdatePrivilegesDto {
	@Type(() => UpdatePrivilegeDto)
	@ValidateNested({ each: true })
	@IsArray()
	@ApiProperty({
		type: [UpdatePrivilegeDto],
	})
	privileges: UpdatePrivilegeDto[];
}
