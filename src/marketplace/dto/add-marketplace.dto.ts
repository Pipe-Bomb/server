import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class AddMarketplaceDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	@IsUrl()
	url: string;
}
