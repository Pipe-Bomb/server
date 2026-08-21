import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBPlaylist } from "./playlist.entity";
import { DBUser } from "src/users/entity/user.entity";
import { PlaylistMemberRole } from "../enum/playlist-member-role.enum";
import { PlaylistMemberResponse } from "../response/playlist-member.response";

@Entity("playlist_members")
export class DBPlaylistMember {
	@PrimaryColumn({ type: "uuid" })
	playlistUuid: string;

	@PrimaryColumn({ type: "uuid" })
	userUuid: string;

	@Column({
		enum: PlaylistMemberRole,
		default: PlaylistMemberRole.VIEWER,
	})
	role: PlaylistMemberRole;

	@CreateDateColumn({ type: "integer" })
	dateAdded: number;

	@ManyToOne(() => DBPlaylist, (playlist) => playlist.members, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "playlistUuid" })
	playlist?: DBPlaylist;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "userUuid" })
	user?: DBUser;

	toResponse(): PlaylistMemberResponse {
		return {
			userUuid: this.userUuid,
			user: this.user?.toResponse() ?? null,
			role: this.role,
			dateAdded: new Date(this.dateAdded),
		};
	}
}
