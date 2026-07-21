import {
	Column,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { UserResponse } from "../response/user.response";
import { DBPlaylist } from "src/playlists/entity/playlist.entity";
import { SavedUser } from "@sdk";
import { DBPrivilege } from "src/privileges/entity/privilege.entity";
import { PrivilegeResponse } from "src/privileges/response/privilege.response";

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

	@OneToMany(() => DBPrivilege, (privilege) => privilege.user)
	privileges?: DBPrivilege[];

	toResponse(privileges?: PrivilegeResponse[]): UserResponse {
		return {
			uuid: this.uuid,
			username: this.username,
			playlists:
				this.playlists?.map((playlist) => playlist.toResponse()) ?? null,
			privileges: privileges ?? null,
		};
	}

	toSavedResponse(): SavedUser {
		return {
			uuid: this.uuid,
			username: this.username,
			playlists:
				this.playlists?.map((playlist) => playlist.toSavedResponse()) ?? null,
		};
	}
}
