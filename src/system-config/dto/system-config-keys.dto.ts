import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class SystemConfigKeysDto {
	@IsArray()
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	@ApiProperty({
		type: [String],
	})
	keys: string[];
}
