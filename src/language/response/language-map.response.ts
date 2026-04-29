import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "LanguageMap" })
export class LanguageMapResponse {
	@ApiProperty()
	id: string;

	@ApiProperty({
		type: "object",
		additionalProperties: {
			type: "string",
		},
	})
	keys: Record<string, string>;
}
