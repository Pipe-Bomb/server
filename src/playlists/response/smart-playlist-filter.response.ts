import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

export abstract class BaseSmartPlaylistFilterResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		enum: AttributeEntity,
		enumName: "AttributeEntity",
	})
	entityType: AttributeEntity;

	@ApiProperty()
	attributeKey: string;

	@ApiProperty({
		enum: AttributeType,
		enumName: "AttributeType",
	})
	attributeType: AttributeType;

	@ApiProperty()
	inverse: boolean;
}

@ApiSchema({ name: "BooleanSmartPlaylistFilter" })
export class BooleanSmartPlaylistFilterResponse extends BaseSmartPlaylistFilterResponse {
	@ApiProperty({ const: AttributeType.BOOLEAN } as any)
	override attributeType: AttributeType.BOOLEAN = AttributeType.BOOLEAN;

	@ApiProperty({
		type: "boolean",
		nullable: true,
	})
	value: boolean | null;
}

@ApiSchema({ name: "StringSmartPlaylistFilter" })
export class StringSmartPlaylistFilterResponse extends BaseSmartPlaylistFilterResponse {
	@ApiProperty({ const: AttributeType.STRING } as any)
	override attributeType: AttributeType.STRING = AttributeType.STRING;

	@ApiProperty({
		type: "string",
		nullable: true,
	})
	value: string | null;

	@ApiProperty()
	partial: boolean;
}

@ApiSchema({ name: "IntegerSmartPlaylistFilter" })
export class IntegerSmartPlaylistFilterResponse extends BaseSmartPlaylistFilterResponse {
	@ApiProperty({ const: AttributeType.INTEGER } as any)
	override attributeType: AttributeType.INTEGER = AttributeType.INTEGER;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	value: number | null;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	min: number | null;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	max: number | null;
}

@ApiSchema({ name: "DecimalSmartPlaylistFilter" })
export class DecimalSmartPlaylistFilterResponse extends BaseSmartPlaylistFilterResponse {
	@ApiProperty({ const: AttributeType.DECIMAL } as any)
	override attributeType: AttributeType.DECIMAL = AttributeType.DECIMAL;

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	value: number | null;

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	min: number | null;

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	max: number | null;
}

@ApiSchema({ name: "BufferSmartPlaylistFilter" })
export class BufferSmartPlaylistFilterResponse extends BaseSmartPlaylistFilterResponse {
	@ApiProperty({ const: AttributeType.BUFFER } as any)
	override attributeType: AttributeType.BUFFER = AttributeType.BUFFER;
}

export type SmartPlaylistFilterResponse =
	| BooleanSmartPlaylistFilterResponse
	| StringSmartPlaylistFilterResponse
	| IntegerSmartPlaylistFilterResponse
	| DecimalSmartPlaylistFilterResponse
	| BufferSmartPlaylistFilterResponse;
