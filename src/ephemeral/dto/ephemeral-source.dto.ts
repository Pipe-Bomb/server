import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";

export class EphemeralSourceDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	pluginId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	sourceId: string;
}
