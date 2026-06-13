import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AttributeType } from "../enum/attribute-type.enum";

@ApiSchema({ name: "LoadedAttribute" })
export class LoadedAttributeResponse {
	@ApiProperty()
	pluginId: string;

	@ApiProperty()
	sourceId: string;

	@ApiProperty()
	key: string;

	@ApiProperty({
		enum: AttributeType,
		enumName: "AttributeType",
	})
	type: AttributeType;

	@ApiProperty()
	supportsMultiple: boolean;
}
