import { IsArray, ValidateNested } from "class-validator";
import { OrderedAttributeSourceDto } from "./ordered-attribute-source.dto";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class AttributeSourceOrderDto {
	@ValidateNested({
		each: true,
	})
	@Type(() => OrderedAttributeSourceDto)
	@IsArray()
	@ApiProperty({
		type: [OrderedAttributeSourceDto],
	})
	sources: OrderedAttributeSourceDto[];
}
