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
	UpdateDateColumn,
} from "typeorm";
import { DBPlaylistTrack } from "./playlist-track.entity";
import { PlaylistResponse } from "../response/playlist.response";
import { DBSmartPlaylistFilterGroup } from "./smart-playlist-filter-group.entity";
import { SavedPlaylist } from "@sdk";
import { PlaylistVisibility } from "../enum/playlist-visibility.enum";

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

	@UpdateDateColumn({
		type: "integer",
	})
	dateModified: number;

	@Column({
		enum: PlaylistVisibility,
		default: PlaylistVisibility.PUBLIC,
	})
	visibility: PlaylistVisibility;

	@OneToMany(
		() => DBPlaylistAttribute,
		(attribute) => attribute.entityRelationId,
	)
	attributes?: DBPlaylistAttribute[];

	@OneToMany(() => DBPlaylistTrack, (track) => track.playlist)
	tracks?: DBPlaylistTrack[];

	@OneToMany(() => DBSmartPlaylistFilterGroup, (group) => group.playlist)
	filterGroups?: DBSmartPlaylistFilterGroup[];

	toResponse(trackCount?: number | null): PlaylistResponse {
		return {
			uuid: this.uuid,
			ownerUuid: this.ownerUuid,
			owner: this.owner?.toResponse() ?? null,
			dateCreated: new Date(this.dateCreated),
			dateModified: new Date(this.dateModified),
			visibility: this.visibility,
			attributes: this.attributes ?? null,
			filterGroups:
				this.filterGroups?.map((group) => group.toResponse()) ?? null,
			tracks:
				this.tracks
					?.map((track) => track.toResponse())
					.filter((track) => !!track) ?? null,
			trackCount: trackCount ?? null,
		};
	}

	toSavedResponse(): SavedPlaylist {
		return {
			uuid: this.uuid,
			ownerUuid: this.ownerUuid,
			owner: this.owner?.toSavedResponse() ?? null,
			dateCreated: new Date(this.dateCreated),
			dateModified: new Date(this.dateModified),
			visibility: this.visibility,
			attributes:
				this.attributes?.map((attribute) => attribute.toSavedAttribute()) ??
				null,
			filters:
				this.filterGroups?.map((group) => group.toSavedResponse()) ?? null,
			tracks: this.tracks?.map((track) => track.toSavedResponse()) ?? null,
		};
	}
}
