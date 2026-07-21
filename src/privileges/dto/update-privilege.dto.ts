import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class UpdatePrivilegeDto {
	@ApiProperty({
		type: String,
		nullable: true,
	})
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@IsNotEmpty()
	pluginId: string | null;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	key: string;

	@ApiProperty()
	@IsBoolean()
	granted: boolean;
}
