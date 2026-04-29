import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "AttributeSource" })
export class AttributeSourceResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	sourceId: string;

	@ApiProperty()
	name: string;
}
