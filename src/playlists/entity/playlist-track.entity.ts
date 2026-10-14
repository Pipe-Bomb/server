import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	Unique,
} from "typeorm";
import { DBPlaylist } from "./playlist.entity";
import { DBTrack } from "src/tracks/entities/track.entity";
import { PlaylistTrackResponse } from "../response/playlist-track.response";
import { PlaylistCreatorResponse } from "../response/playlist-creator.response";
import { PlaylistCreatorTypeEnum } from "../enum/playlist-creator-type.enum";
import { DBUser } from "src/users/entity/user.entity";
import {
	PlaylistBotInfo,
	SavedPlaylistCreator,
	SavedPlaylistTrack,
} from "@sdk";

@Entity("playlist_tracks")
@Unique("IDX_playlistUuid_trackUuid", ["playlistUuid", "trackUuid"])
@Index("IDX_playlist_tracks_sort", ["playlistUuid", "dateAdded", "ordinal"])
export class DBPlaylistTrack {
	@PrimaryColumn({
		type: "uuid",
	})
	playlistUuid: string;

	@PrimaryColumn({
		type: "uuid",
	})
	trackUuid: string;

	@CreateDateColumn({
		type: "integer",
	})
	dateAdded: number;

	@Column({
		type: "int",
		default: 0,
	})
	ordinal: number;

	@Column({
		type: "uuid",
		nullable: true,
	})
	addedByUuid: string | null;

	@Column({
		type: "text",
		nullable: true,
	})
	addedByPluginId: string | null;

	@Column({
		type: "text",
		nullable: true,
	})
	addedByBotId: string | null;

	@ManyToOne(() => DBUser)
	@JoinColumn({ name: "addedByUuid" })
	addedBy?: DBUser | null;

	@ManyToOne(() => DBPlaylist, (playlist) => playlist.tracks, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "playlistUuid" })
	playlist?: DBPlaylist;

	@ManyToOne(() => DBTrack, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

	toResponse(
		getBotInfo: (pluginId: string, botId: string) => PlaylistBotInfo | null,
	): PlaylistTrackResponse | null {
		if (!this.track) {
			return null;
		}

		let addedBy: PlaylistCreatorResponse;

		if (this.addedByUuid) {
			addedBy = {
				type: PlaylistCreatorTypeEnum.USER,
				userUuid: this.addedByUuid,
				user: this.addedBy?.toResponse() ?? null,
			};
		} else if (this.addedByPluginId && this.addedByBotId) {
			addedBy = {
				type: PlaylistCreatorTypeEnum.BOT,
				pluginId: this.addedByPluginId,
				botId: this.addedByBotId,
				botName:
					getBotInfo(this.addedByPluginId, this.addedByBotId)?.name ?? null,
			};
		} else {
			addedBy = {
				type: PlaylistCreatorTypeEnum.SYSTEM,
			};
		}

		return {
			track: this.track.toResponse(),
			dateAdded: new Date(this.dateAdded),
			addedBy,
		};
	}

	toSavedResponse(): SavedPlaylistTrack {
		let addedBy: SavedPlaylistCreator;

		if (this.addedByUuid) {
			addedBy = {
				isUser: true,
				userUuid: this.addedByUuid,
				user: this.addedBy?.toSavedResponse() ?? null,
			};
		} else if (this.addedByPluginId && this.addedByBotId) {
			addedBy = {
				isUser: false,
				addedByPluginId: this.addedByPluginId,
				addedByBotId: this.addedByBotId,
			};
		} else {
			addedBy = {
				isUser: false,
				addedByPluginId: null,
				addedByBotId: null,
			};
		}

		return {
			playlistUuid: this.playlistUuid,
			trackUuid: this.trackUuid,
			dateAdded: new Date(this.dateAdded),
			ordinal: this.ordinal,
			playlist: this.playlist?.toSavedResponse() ?? null,
			track: this.track?.toSavedResponse() ?? null,
			addedBy,
		};
	}
}
