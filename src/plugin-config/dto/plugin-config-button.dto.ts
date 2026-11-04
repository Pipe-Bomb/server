import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@ApiSchema()
export class PluginConfigButtonDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;
}
