import { Column, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import {
	PersistentAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "../response/persistent-attribute.response";
import { DBResource } from "src/resources/entities/resource.entity";
import { SavedAttribute, SavedAttributeValues } from "@sdk";
import { AttributeType } from "../enum/attribute-type.enum";
import { ResourceResponse } from "src/resources/response/resource.response";

@Index(["entityRelationId"])
export abstract class DBAttributeTemplate {
	@PrimaryColumn({
		type: "uuid",
	})
	entityId: string;

	@JoinColumn()
	abstract entityRelationId: string;

	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	sourceId: string;

	@PrimaryColumn({
		type: "text",
	})
	key: string;

	@PrimaryColumn({
		type: "integer",
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

		if (this.value_boolean !== null && this.value_boolean !== undefined) {
			attribute = new PersistentBooleanAttributeResponse();
			// attribute.type = AttributeType.BOOLEAN;
			attribute.values = [this.value_boolean];
		}

		if (this.value_string !== null && this.value_string !== undefined) {
			attribute = new PersistentStringAttributeResponse();
			// attribute.type = AttributeType.STRING;
			attribute.values = [this.value_string];
		}

		if (this.value_int !== null && this.value_int !== undefined) {
			attribute = new PersistentIntegerAttributeResponse();
			// attribute.type = AttributeType.INTEGER;
			attribute.values = [this.value_int];
		}

		if (this.value_decimal !== null && this.value_decimal !== undefined) {
			attribute = new PersistentDecimalAttributeResponse();
			// attribute.type = AttributeType.DECIMAL;
			attribute.values = [this.value_decimal];
		}

		if (this.value_buffer !== null && this.value_buffer !== undefined) {
			attribute = new PersistentBufferAttributeResponse();
			// attribute.type = AttributeType.BUFFER;
			attribute.values = [this.value_buffer.toResponse()];
		}

		if (!attribute) {
			throw new Error("Attribute had no value");
		}

		attribute.pluginId = this.pluginId;
		attribute.sourceId = this.sourceId;

		return attribute;
	}

	toSavedAttribute(): SavedAttribute {
		const attribute = this.toResponse();

		const values: any[] = [];
		if (attribute.type == AttributeType.BUFFER) {
			values.push(
				...(attribute.values as ResourceResponse[]).map(
					(value) =>
						({
							uuid: value.uuid,
							url: value.url.url,
							extension: value.extension,
						}) as SavedAttributeValues["buffer"],
				),
			);
		} else {
			values.push(...attribute.values);
		}

		return {
			type: attribute.type,
			values,
			key: this.key,
			pluginId: this.pluginId,
			sourceId: this.sourceId,
		};
	}
}
