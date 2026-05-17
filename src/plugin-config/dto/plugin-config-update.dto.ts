import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class PluginConfigUpdateDto {
	@ApiProperty({
		type: "object",
		additionalProperties: true,
	})
	@IsObject()
	values: Record<string, any>;
}
