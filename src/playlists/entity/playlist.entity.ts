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
import { PlaylistBotInfo, SavedPlaylist, SavedPlaylistCreator } from "@sdk";
import { PlaylistVisibility } from "../enum/playlist-visibility.enum";
import { PlaylistCreatorResponse } from "../response/playlist-creator.response";
import { PlaylistCreatorTypeEnum } from "../enum/playlist-creator-type.enum";

@Entity("playlists")
export class DBPlaylist {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
		nullable: true,
	})
	ownerUuid: string | null;

	@Column({
		type: "text",
		nullable: true,
	})
	ownerPluginId: string | null;

	@Column({
		type: "text",
		nullable: true,
	})
	ownerBotId: string | null;

	@Column({
		type: "boolean",
		default: false,
	})
	public: boolean;

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
		default: PlaylistVisibility.UNLISTED,
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
		trackCount: number | null,
		getBotInfo: (pluginId: string, botId: string) => PlaylistBotInfo | null,
		members?: PlaylistMemberResponse[],
	): PlaylistResponse {
		let owner: PlaylistCreatorResponse;

		if (this.ownerUuid) {
			owner = {
				type: PlaylistCreatorTypeEnum.USER,
				userUuid: this.ownerUuid,
				user: this.owner?.toResponse() ?? null,
			};
		} else if (this.ownerPluginId && this.ownerBotId) {
			owner = {
				type: PlaylistCreatorTypeEnum.BOT,
				pluginId: this.ownerPluginId,
				botId: this.ownerBotId,
				botName: getBotInfo(this.ownerPluginId, this.ownerBotId)?.name ?? null,
			};
		} else {
			owner = {
				type: PlaylistCreatorTypeEnum.SYSTEM,
			};
		}

		return {
			uuid: this.uuid,
			owner,
			dateCreated: new Date(this.dateCreated),
			dateModified: new Date(this.dateModified),
			visibility: this.visibility,
			attributes: this.attributes ?? null,
			filterGroups:
				this.filterGroups?.map((group) => group.toResponse()) ?? null,
			tracks:
				this.tracks
					?.map((track) => track.toResponse(getBotInfo))
					.filter((track) => !!track) ?? null,
			trackCount: trackCount ?? null,
			members: members ?? null,
		};
	}

	toSavedResponse(
		options: {
			noRelations?: boolean;
		} = {},
	): SavedPlaylist {
		let owner: SavedPlaylistCreator;

		if (this.ownerUuid) {
			owner = {
				isUser: true,
				userUuid: this.ownerUuid,
				user: this.owner?.toSavedResponse() ?? null,
			};
		} else if (this.ownerPluginId && this.ownerBotId) {
			owner = {
				isUser: false,
				addedByPluginId: this.ownerPluginId,
				addedByBotId: this.ownerBotId,
			};
		} else {
			owner = {
				isUser: false,
				addedByPluginId: null,
				addedByBotId: null,
			};
		}

		return {
			uuid: this.uuid,
			owner,
			dateCreated: new Date(this.dateCreated),
			dateModified: new Date(this.dateModified),
			visibility: this.visibility,
			attributes:
				(!options.noRelations &&
					this.attributes?.map((attribute) => attribute.toSavedAttribute())) ||
				null,
			filters:
				(!options.noRelations &&
					this.filterGroups?.map((group) => group.toSavedResponse())) ||
				null,
			tracks:
				(!options.noRelations &&
					this.tracks?.map((track) => track.toSavedResponse())) ||
				null,
		};
	}
}
