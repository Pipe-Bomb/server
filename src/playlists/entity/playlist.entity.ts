import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { DBUser } from "src/users/entity/user.entity";
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { DBPlaylistTrack } from "./playlist-track.entity";
import { PlaylistResponse } from "../response/playlist.response";

@Entity("playlists")
export class DBPlaylist {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
	})
	ownerUuid: string;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE" })
	@JoinColumn({ name: "ownerUuid" })
	owner?: DBUser;

	@CreateDateColumn({
		type: "integer",
	})
	dateCreated: number;

	@OneToMany(
		() => DBPlaylistAttribute,
		(attribute) => attribute.entityRelationId,
	)
	attributes?: DBPlaylistAttribute[];

	@OneToMany(() => DBPlaylistTrack, (track) => track.playlist)
	tracks?: DBPlaylistTrack[];

	toResponse(trackCount?: number | null): PlaylistResponse {
		return {
			uuid: this.uuid,
			ownerUuid: this.ownerUuid,
			owner: this.owner?.toResponse() ?? null,
			attributes: this.attributes ?? null,
			tracks:
				this.tracks
					?.map((track) => track.toResponse())
					.filter((track) => !!track) ?? null,
			trackCount: trackCount ?? null,
		};
	}
}
