import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import {
	BaseCustomAttributeDto,
	ContainedCustomAttributeDto,
	CustomAttributeDto,
	CustomBooleanAttributeDto,
	CustomBufferAttributeDto,
	CustomDecimalAttributeDto,
	CustomIntegerAttributeDto,
	CustomStringAttributeDto,
} from "src/attributes/dto/custom-attribute.dto";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

@ApiExtraModels(
	CustomStringAttributeDto,
	CustomBooleanAttributeDto,
	CustomIntegerAttributeDto,
	CustomDecimalAttributeDto,
	CustomBufferAttributeDto,
)
export class CreatePlaylistDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BaseCustomAttributeDto, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: "type",
			subTypes: [
				{ value: CustomStringAttributeDto, name: AttributeType.STRING },
				{ value: CustomBooleanAttributeDto, name: AttributeType.BOOLEAN },
				{ value: CustomIntegerAttributeDto, name: AttributeType.INTEGER },
				{ value: CustomDecimalAttributeDto, name: AttributeType.DECIMAL },
				// { value: CustomBufferAttributeDto, name: AttributeType.BUFFER },
			],
		},
	})
	@ApiProperty({
		nullable: true,
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(CustomStringAttributeDto) },
				{ $ref: getSchemaPath(CustomBooleanAttributeDto) },
				{ $ref: getSchemaPath(CustomIntegerAttributeDto) },
				{ $ref: getSchemaPath(CustomDecimalAttributeDto) },
				// { $ref: getSchemaPath(CustomBufferAttributeDto) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[AttributeType.STRING]: getSchemaPath(CustomStringAttributeDto),
					[AttributeType.BOOLEAN]: getSchemaPath(CustomBooleanAttributeDto),
					[AttributeType.INTEGER]: getSchemaPath(CustomIntegerAttributeDto),
					[AttributeType.DECIMAL]: getSchemaPath(CustomDecimalAttributeDto),
					// [AttributeType.BUFFER]: getSchemaPath(CustomBufferAttributeDto),
				},
			},
		},
	})
	attributes: ContainedCustomAttributeDto[];
}
