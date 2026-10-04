import {
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBAlbum } from "./album.entity";
import { DBUser } from "src/users/entity/user.entity";

@Entity("saved_albums")
export class DBSavedAlbum {
	@PrimaryColumn({ type: "uuid" })
	albumUuid: string;

	@PrimaryColumn({ type: "uuid" })
	userUuid: string;

	@ManyToOne(() => DBAlbum, { onDelete: "CASCADE" })
	@JoinColumn({ name: "albumUuid" })
	album?: DBAlbum;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	@CreateDateColumn({ type: "integer" })
	dateAdded: number;
}
