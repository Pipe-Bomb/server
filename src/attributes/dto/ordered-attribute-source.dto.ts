import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class OrderedAttributeSourceDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	pluginId: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty()
	sourceId: string;
}
