import {
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBUser } from "src/users/entity/user.entity";

@Entity("saved_artists")
export class DBSavedArtist {
	@PrimaryColumn({ type: "uuid" })
	artistUuid: string;

	@PrimaryColumn({ type: "uuid" })
	userUuid: string;

	@ManyToOne(() => DBArtist, { onDelete: "CASCADE" })
	@JoinColumn({ name: "artistUuid" })
	artist?: DBArtist;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	@CreateDateColumn({ type: "integer" })
	dateAdded: number;
}
