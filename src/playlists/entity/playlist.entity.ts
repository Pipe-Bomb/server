import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { DBUser } from "src/users/entity/user.entity";
import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { DBPlaylistTrack } from "./playlist-track.entity";
import { DBPlaylistMember } from "./playlist-member.entity";
import { PlaylistResponse } from "../response/playlist.response";
import { PlaylistMemberResponse } from "../response/playlist-member.response";
import { DBSmartPlaylistFilterGroup } from "./smart-playlist-filter-group.entity";
import { SavedPlaylist } from "@sdk";
import { PlaylistVisibility } from "../enum/playlist-visibility.enum";

@Entity("playlists")
export class DBPlaylist {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
		nullable: true,
	})
	ownerUuid: string | null;

	@ManyToOne(() => DBUser, { onDelete: "CASCADE", nullable: true })
	@JoinColumn({ name: "ownerUuid" })
	owner?: DBUser | null;

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

	@Column({ type: "uuid", nullable: true })
	@Index()
	lastSmartFilterScanRunId: string | null;

	@OneToMany(
		() => DBPlaylistAttribute,
		(attribute) => attribute.entityRelationId,
	)
	attributes?: DBPlaylistAttribute[];

	@OneToMany(() => DBPlaylistTrack, (track) => track.playlist)
	tracks?: DBPlaylistTrack[];

	@OneToMany(() => DBSmartPlaylistFilterGroup, (group) => group.playlist)
	filterGroups?: DBSmartPlaylistFilterGroup[];

	@OneToMany(() => DBPlaylistMember, (member) => member.playlist)
	members?: DBPlaylistMember[];

	toResponse(
		trackCount?: number | null,
		members?: PlaylistMemberResponse[],
	): PlaylistResponse {
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
			members: members ?? null,
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
