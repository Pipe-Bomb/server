import { DBUser } from "src/users/entity/user.entity";
import {
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	Unique,
} from "typeorm";

@Entity("privilege")
@Unique("IDX_userUuid_privilegeKey_pluginId", ["userUuid", "privilegeKey"])
export class DBPrivilege {
	@PrimaryColumn({
		type: "uuid",
	})
	userUuid: string;

	@PrimaryColumn({
		type: "text",
	})
	privilegeKey: string;

	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@ManyToOne(() => DBUser, (user) => user.privileges, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	@CreateDateColumn({
		type: "integer",
	})
	dateCreated: number;
}
