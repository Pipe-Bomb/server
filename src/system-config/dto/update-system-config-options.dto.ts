import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { SystemConfigType } from "../enum/system-config-type.enum";
import {
	BaseUpdateSystemConfigOptionDto,
	BooleanUpdateSystemConfigOptionDto,
	DecimalUpdateSystemConfigOptionDto,
	IntegerUpdateSystemConfigOptionDto,
	StringUpdateSystemConfigOptionDto,
	UpdateSystemConfigOptionDto,
} from "./update-system-config-option.dto";

@ApiExtraModels(
	StringUpdateSystemConfigOptionDto,
	BooleanUpdateSystemConfigOptionDto,
	IntegerUpdateSystemConfigOptionDto,
	DecimalUpdateSystemConfigOptionDto,
)
export class UpdateSystemConfigOptionsDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BaseUpdateSystemConfigOptionDto, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: "type",
			subTypes: [
				{
					value: StringUpdateSystemConfigOptionDto,
					name: SystemConfigType.STRING,
				},
				{
					value: BooleanUpdateSystemConfigOptionDto,
					name: SystemConfigType.BOOLEAN,
				},
				{
					value: IntegerUpdateSystemConfigOptionDto,
					name: SystemConfigType.INTEGER,
				},
				{
					value: DecimalUpdateSystemConfigOptionDto,
					name: SystemConfigType.DECIMAL,
				},
			],
		},
	})
	@ApiProperty({
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringUpdateSystemConfigOptionDto) },
				{ $ref: getSchemaPath(BooleanUpdateSystemConfigOptionDto) },
				{ $ref: getSchemaPath(IntegerUpdateSystemConfigOptionDto) },
				{ $ref: getSchemaPath(DecimalUpdateSystemConfigOptionDto) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[SystemConfigType.STRING]: getSchemaPath(
						StringUpdateSystemConfigOptionDto,
					),
					[SystemConfigType.BOOLEAN]: getSchemaPath(
						BooleanUpdateSystemConfigOptionDto,
					),
					[SystemConfigType.INTEGER]: getSchemaPath(
						IntegerUpdateSystemConfigOptionDto,
					),
					[SystemConfigType.DECIMAL]: getSchemaPath(
						DecimalUpdateSystemConfigOptionDto,
					),
				},
			},
		},
	})
	options: UpdateSystemConfigOptionDto[];
}
