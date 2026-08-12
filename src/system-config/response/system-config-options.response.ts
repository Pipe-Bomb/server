import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { SystemConfigType } from "src/system-config/enum/system-config-type.enum";
import {
	BooleanSystemConfigOptionResponse,
	DecimalSystemConfigOptionResponse,
	IntegerSystemConfigOptionResponse,
	StringSystemConfigOptionResponse,
	SystemConfigOptionResponse,
} from "src/system-config/response/system-config-option.response";

@ApiExtraModels(
	StringSystemConfigOptionResponse,
	IntegerSystemConfigOptionResponse,
	DecimalSystemConfigOptionResponse,
	BooleanSystemConfigOptionResponse,
)
@ApiSchema({ name: "SystemConfigOptions" })
export class SystemConfigOptionsResponse {
	@ApiProperty({
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringSystemConfigOptionResponse) },
				{ $ref: getSchemaPath(IntegerSystemConfigOptionResponse) },
				{ $ref: getSchemaPath(DecimalSystemConfigOptionResponse) },
				{ $ref: getSchemaPath(BooleanSystemConfigOptionResponse) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[SystemConfigType.STRING]: getSchemaPath(
						StringSystemConfigOptionResponse,
					),
					[SystemConfigType.BOOLEAN]: getSchemaPath(
						IntegerSystemConfigOptionResponse,
					),
					[SystemConfigType.INTEGER]: getSchemaPath(
						DecimalSystemConfigOptionResponse,
					),
					[SystemConfigType.DECIMAL]: getSchemaPath(
						BooleanSystemConfigOptionResponse,
					),
				},
			},
		},
	})
	options: SystemConfigOptionResponse[];
}
