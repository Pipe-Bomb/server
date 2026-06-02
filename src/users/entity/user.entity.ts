import {
	Column,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { UserResponse } from "../response/user.response";
import { DBPlaylist } from "src/playlists/entity/playlist.entity";

@Entity("users")
export class DBUser {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "text",
	})
	@Index({
		unique: true,
	})
	username: string;

	@Column({
		type: "text",
	})
	passwordHash: string;

	@Column({
		type: "text",
	})
	passwordSalt: string;

	@OneToMany(() => DBPlaylist, (playlist) => playlist.owner)
	playlists?: DBPlaylist[];

	toResponse(): UserResponse {
		return {
			uuid: this.uuid,
			username: this.username,
			playlists:
				this.playlists?.map((playlist) => playlist.toResponse()) ?? null,
		};
	}
}
