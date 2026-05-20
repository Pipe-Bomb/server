import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class EphemeralSearchDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	pluginId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	sourceId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	query: string;
}
