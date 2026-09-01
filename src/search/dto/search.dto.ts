import {
	ApiExtraModels,
	ApiProperty,
	ApiPropertyOptional,
	getSchemaPath,
} from "@nestjs/swagger";
import {
	IsArray,
	IsBoolean,
	IsOptional,
	IsString,
	ValidateIf,
	ValidateNested,
} from "class-validator";
import {
	BaseSearchAttributeDto,
	BooleanSearchAttributeDto,
	BufferSearchAttributeDto,
	DecimalSearchAttributeDto,
	IntegerSearchAttributeDto,
	SearchAttributeDto,
	StringSearchAttributeDto,
} from "./search-attribute.dto";
import { Type } from "class-transformer";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { SearchSortDto } from "./search-sort.dto";

@ApiExtraModels(
	StringSearchAttributeDto,
	BooleanSearchAttributeDto,
	IntegerSearchAttributeDto,
	DecimalSearchAttributeDto,
	BufferSearchAttributeDto,
)
export class SearchDto {
	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withTracks: boolean;

	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withAlbums: boolean;

	@IsBoolean()
	@ApiProperty({
		type: "boolean",
	})
	withArtists: boolean;

	@ValidateIf((_, value) => value !== null)
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BaseSearchAttributeDto, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: "type",
			subTypes: [
				{ value: StringSearchAttributeDto, name: AttributeType.STRING },
				{ value: BooleanSearchAttributeDto, name: AttributeType.BOOLEAN },
				{ value: IntegerSearchAttributeDto, name: AttributeType.INTEGER },
				{ value: DecimalSearchAttributeDto, name: AttributeType.DECIMAL },
				{ value: BufferSearchAttributeDto, name: AttributeType.BUFFER },
			],
		},
	})
	@ApiProperty({
		nullable: true,
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringSearchAttributeDto) },
				{ $ref: getSchemaPath(BooleanSearchAttributeDto) },
				{ $ref: getSchemaPath(IntegerSearchAttributeDto) },
				{ $ref: getSchemaPath(DecimalSearchAttributeDto) },
				{ $ref: getSchemaPath(BufferSearchAttributeDto) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[AttributeType.STRING]: getSchemaPath(StringSearchAttributeDto),
					[AttributeType.BOOLEAN]: getSchemaPath(BooleanSearchAttributeDto),
					[AttributeType.INTEGER]: getSchemaPath(IntegerSearchAttributeDto),
					[AttributeType.DECIMAL]: getSchemaPath(DecimalSearchAttributeDto),
					[AttributeType.BUFFER]: getSchemaPath(BufferSearchAttributeDto),
				},
			},
		},
	})
	attributes: SearchAttributeDto[] | null;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	query?: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => SearchSortDto)
	@ApiPropertyOptional({ type: SearchSortDto })
	sort?: SearchSortDto;
}
