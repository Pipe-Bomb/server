import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class InstallPluginDto {
	@IsString()
	@IsNotEmpty()
	url: string;

	@IsString()
	@IsOptional()
	ref?: string;
}
