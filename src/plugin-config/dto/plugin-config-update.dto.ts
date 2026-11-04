import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsObject } from "class-validator";

@ApiSchema()
export class PluginConfigUpdateDto {
	@ApiProperty({
		type: "object",
		additionalProperties: true,
	})
	@IsObject()
	values: Record<string, any>;
}
