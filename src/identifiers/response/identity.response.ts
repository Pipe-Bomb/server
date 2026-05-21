import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "Identity" })
export class IdentityResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	identityId: string;

	// @ApiProperty()
	// entityId: string;

	@ApiProperty()
	value: string;

	@ApiProperty({
		type: "integer",
	})
	ordinal: number;
}
