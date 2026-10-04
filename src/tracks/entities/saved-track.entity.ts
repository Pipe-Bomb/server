import {
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBTrack } from "./track.entity";
import { DBUser } from "src/users/entity/user.entity";

@Entity("saved_tracks")
export class DBSavedTrack {
	@PrimaryColumn({ type: "uuid" })
	trackUuid: string;

	@PrimaryColumn({ type: "uuid" })
	userUuid: string;

	@ManyToOne(() => DBTrack, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	@CreateDateColumn({ type: "integer" })
	dateAdded: number;
}
