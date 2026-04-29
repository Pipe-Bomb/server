import { Column, ManyToOne, PrimaryColumn } from "typeorm";
import {
	PersistentAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "../response/persistent-attribute.response";
import { AttributeType } from "../enum/attribute-type.enum";
import { DBResource } from "src/resources/entities/resource.entity";

export abstract class DBAttributeTemplate {
	@PrimaryColumn({
		type: "text",
	})
	abstract entityId: string;

	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	key: string;

	@PrimaryColumn({
		type: "integer",
		default: 0,
	})
	ordinal: number;

	@Column({
		type: "text",
		nullable: true,
	})
	value_string: string | null;

	@Column({
		type: "integer",
		nullable: true,
	})
	value_int: number | null;

	@Column({
		type: "double precision",
		nullable: true,
	})
	value_decimal: number | null;

	@Column({
		type: "boolean",
		nullable: true,
	})
	value_boolean: boolean | null;

	@ManyToOne(() => DBResource, {
		nullable: true,
		eager: true,
	})
	value_buffer: DBResource | null;

	toResponse(): PersistentAttributeResponse {
		let attribute: PersistentAttributeResponse | null = null;

		if (this.value_boolean !== null) {
			attribute = new PersistentBooleanAttributeResponse();
			attribute.type = AttributeType.BOOLEAN;
			attribute.values = [this.value_boolean];
		}

		if (this.value_string !== null) {
			attribute = new PersistentStringAttributeResponse();
			attribute.type = AttributeType.STRING;
			attribute.values = [this.value_string];
		}

		if (this.value_int !== null) {
			attribute = new PersistentIntegerAttributeResponse();
			attribute.type = AttributeType.INTEGER;
			attribute.values = [this.value_int];
		}

		if (this.value_decimal !== null) {
			attribute = new PersistentDecimalAttributeResponse();
			attribute.type = AttributeType.DECIMAL;
			attribute.values = [this.value_decimal];
		}

		if (this.value_buffer !== null) {
			attribute = new PersistentBufferAttributeResponse();
			attribute.type = AttributeType.BUFFER;
			attribute.values = [this.value_buffer.toResponse()];
			console.log(attribute);
		}

		if (!attribute) {
			throw new Error("Attribute had no value");
		}

		return attribute;
	}
}
