import { DBTrack } from "src/tracks/entities/track.entity";
import { DBUser } from "src/users/entity/user.entity";
import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";

@Entity("playback_history_entries")
@Unique(["trackUuid", "userUuid", "datePlayed", "pluginId", "clientName"])
@Index(["userUuid", "datePlayed"])
export class DBPlaybackHistoryEntry {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
		name: "trackUuid",
	})
	trackUuid: string;

	@ManyToOne(() => DBTrack, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

	@Column({
		type: "uuid",
		name: "userUuid",
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

	@CreateDateColumn({
		type: "integer",
	})
	dateRecorded: number;

	@Column({
		type: "text",
		nullable: true,
	})
	pluginId: string | null;

	@Column({
		type: "text",
	})
	clientName: string;
}
