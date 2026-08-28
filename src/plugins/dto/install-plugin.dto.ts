import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class InstallPluginDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	url: string;

	@IsString()
	@IsOptional()
	@ApiPropertyOptional({
		type: String,
	})
	ref?: string;
}
