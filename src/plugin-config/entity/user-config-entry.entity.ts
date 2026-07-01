import { DBUser } from "src/users/entity/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

@Entity("user_config_entries")
export class DBUserConfigEntry {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	configId: string;

	@PrimaryColumn({
		type: "text",
	})
	key: string;

	@PrimaryColumn({
		type: "int",
	})
	ordinal: number;

	@PrimaryColumn({
		type: "uuid",
	})
	userUuid: string;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

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
}
