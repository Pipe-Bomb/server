import { DBTrack } from "src/tracks/entities/track.entity";
import { DBUser } from "src/users/entity/user.entity";
import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";

@Entity("playback_history_entries")
export class DBPlaybackHistoryEntry {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
	})
	trackUuid: string;

	@ManyToOne(() => DBTrack, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

	@Column({
		type: "uuid",
	})
	userUuid: string;

	@ManyToOne(() => DBUser, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	@Column({
		type: "integer",
	})
	datePlayed: number;
}
