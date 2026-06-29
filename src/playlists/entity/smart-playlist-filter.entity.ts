import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { AttributeEntity } from "src/attribute-sources/enum/attribute-entity.enum";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";
import { DBSmartPlaylistFilterGroup } from "./smart-playlist-filter-group.entity";
import {
	BaseSmartPlaylistFilterResponse,
	SmartPlaylistFilterResponse,
} from "../response/smart-playlist-filter.response";
import { AttributeValues, SavedAttributeValues, SavedSmartFilter } from "@sdk";

@Entity("smart_playlist_filters")
export class DBSmartPlaylistFilter {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
	})
	groupUuid: string;

	@ManyToOne(() => DBSmartPlaylistFilterGroup, { onDelete: "CASCADE" })
	@JoinColumn({ name: "groupUuid" })
	group?: DBSmartPlaylistFilterGroup;

	@Column({
		enum: AttributeEntity,
	})
	entityType: AttributeEntity;

	@Column({
		type: "text",
	})
	attributeKey: string;

	@Column({
		enum: AttributeType,
	})
	attributeType: AttributeType;

	@Column({
		type: "boolean",
		nullable: true,
	})
	value_boolean: boolean | null;

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
		default: false,
	})
	inverse: boolean;

	@Column({
		type: "double precision",
		nullable: true,
	})
	min: number | null;

	@Column({
		type: "double precision",
		nullable: true,
	})
	max: number | null;

	@Column({
		type: "boolean",
		nullable: true,
	})
	partial: boolean | null;

	toResponse(): SmartPlaylistFilterResponse {
		const base: BaseSmartPlaylistFilterResponse = {
			uuid: this.uuid,
			entityType: this.entityType,
			attributeKey: this.attributeKey,
			attributeType: this.attributeType,
			inverse: this.inverse,
		};

		switch (base.attributeType) {
			case AttributeType.STRING:
				return {
					...base,
					attributeType: AttributeType.STRING,
					value: this.value_string,
					partial: this.partial == true,
				};

			case AttributeType.BOOLEAN:
				return {
					...base,
					attributeType: AttributeType.BOOLEAN,
					value: this.value_boolean,
				};

			case AttributeType.INTEGER:
				return {
					...base,
					attributeType: AttributeType.INTEGER,
					value: this.value_int,
					min: this.min === null ? null : Math.floor(this.min),
					max: this.max === null ? null : Math.floor(this.max),
				};

			case AttributeType.DECIMAL:
				return {
					...base,
					attributeType: AttributeType.DECIMAL,
					value: this.value_int,
					min: this.min,
					max: this.max,
				};

			case AttributeType.BUFFER:
				return {
					...base,
					attributeType: AttributeType.BUFFER,
				};
			default:
				throw new Error("Not implemented");
		}
	}

	toSavedResponse(): SavedSmartFilter {
		const value: SavedAttributeValues[AttributeType] | null = (() => {
			switch (this.attributeType) {
				case AttributeType.BOOLEAN:
					return this.value_boolean;
				case AttributeType.DECIMAL:
					return this.value_decimal;
				case AttributeType.INTEGER:
					return this.value_int;
				case AttributeType.STRING:
					return this.value_string;
				default:
					return null;
			}
		})();

		return {
			uuid: this.uuid,
			groupUuid: this.groupUuid,
			group: this.group?.toSavedResponse() ?? null,
			entityType: this.entityType,
			attributeKey: this.attributeKey,
			attributeType: this.attributeType as Exclude<
				keyof AttributeValues,
				"buffer"
			>,
			value,
			inverse: this.inverse,
			min: this.min,
			max: this.max,
			partial: this.partial,
		};
	}
}
