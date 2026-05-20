import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "EphemeralSource" })
export class EphemeralSourceResponse {
	@ApiProperty()
	id: string;

	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	name: string;
}
