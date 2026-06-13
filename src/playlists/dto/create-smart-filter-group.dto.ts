import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import {
	BaseSmartFilterDto,
	BooleanSmartFilterDto,
	BufferSmartFilterDto,
	DecimalSmartFilterDto,
	IntegerSmartFilterDto,
	SmartFilterDto,
	StringSmartFilterDto,
} from "./create-smart-filter.dto";

@ApiExtraModels(
	StringSmartFilterDto,
	BooleanSmartFilterDto,
	IntegerSmartFilterDto,
	DecimalSmartFilterDto,
	BufferSmartFilterDto,
)
export class CreateSmartFilterGroupDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BaseSmartFilterDto, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: "attributeType",
			subTypes: [
				{ value: StringSmartFilterDto, name: AttributeType.STRING },
				{ value: BooleanSmartFilterDto, name: AttributeType.BOOLEAN },
				{ value: IntegerSmartFilterDto, name: AttributeType.INTEGER },
				{ value: DecimalSmartFilterDto, name: AttributeType.DECIMAL },
				{ value: BufferSmartFilterDto, name: AttributeType.BUFFER },
			],
		},
	})
	@ApiProperty({
		nullable: true,
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringSmartFilterDto) },
				{ $ref: getSchemaPath(BooleanSmartFilterDto) },
				{ $ref: getSchemaPath(IntegerSmartFilterDto) },
				{ $ref: getSchemaPath(DecimalSmartFilterDto) },
				{ $ref: getSchemaPath(BufferSmartFilterDto) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[AttributeType.STRING]: getSchemaPath(StringSmartFilterDto),
					[AttributeType.BOOLEAN]: getSchemaPath(BooleanSmartFilterDto),
					[AttributeType.INTEGER]: getSchemaPath(IntegerSmartFilterDto),
					[AttributeType.DECIMAL]: getSchemaPath(DecimalSmartFilterDto),
					[AttributeType.BUFFER]: getSchemaPath(BufferSmartFilterDto),
				},
			},
		},
	})
	filters: SmartFilterDto[];
}
