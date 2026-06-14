import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import {
	BooleanSmartPlaylistFilterResponse,
	BufferSmartPlaylistFilterResponse,
	DecimalSmartPlaylistFilterResponse,
	IntegerSmartPlaylistFilterResponse,
	SmartPlaylistFilterResponse,
	StringSmartPlaylistFilterResponse,
} from "./smart-playlist-filter.response";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

@ApiSchema({ name: "SmartPlaylistFilterGroup" })
@ApiExtraModels(
	StringSmartPlaylistFilterResponse,
	BooleanSmartPlaylistFilterResponse,
	IntegerSmartPlaylistFilterResponse,
	DecimalSmartPlaylistFilterResponse,
	BufferSmartPlaylistFilterResponse,
)
export class SmartPlaylistFilterGroupResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		type: Date,
	})
	dateCreated: Date;

	@ApiProperty({
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringSmartPlaylistFilterResponse) },
				{ $ref: getSchemaPath(BooleanSmartPlaylistFilterResponse) },
				{ $ref: getSchemaPath(IntegerSmartPlaylistFilterResponse) },
				{ $ref: getSchemaPath(DecimalSmartPlaylistFilterResponse) },
				{ $ref: getSchemaPath(BufferSmartPlaylistFilterResponse) },
			],
			discriminator: {
				propertyName: "attributeType",
				mapping: {
					[AttributeType.STRING]: getSchemaPath(
						StringSmartPlaylistFilterResponse,
					),
					[AttributeType.BOOLEAN]: getSchemaPath(
						BooleanSmartPlaylistFilterResponse,
					),
					[AttributeType.INTEGER]: getSchemaPath(
						IntegerSmartPlaylistFilterResponse,
					),
					[AttributeType.DECIMAL]: getSchemaPath(
						DecimalSmartPlaylistFilterResponse,
					),
					[AttributeType.BUFFER]: getSchemaPath(
						BufferSmartPlaylistFilterResponse,
					),
				},
			},
		},
	})
	filters: SmartPlaylistFilterResponse[];
}
