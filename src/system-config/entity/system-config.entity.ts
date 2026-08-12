import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("system-config")
export class DBSystemConfig {
	@PrimaryColumn({
		type: "text",
	})
	key: string;

	@PrimaryColumn({
		type: "int",
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

	@UpdateDateColumn({ type: "integer" })
	dateAdded: number;
}
