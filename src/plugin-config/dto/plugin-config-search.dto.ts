import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@ApiSchema()
export class PluginConfigSearchDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;

	@ApiProperty()
	@IsString()
	query: string;
}
