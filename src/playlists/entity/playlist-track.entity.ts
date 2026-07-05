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
import { DBUser } from "src/users/entity/user.entity";
import { SavedPlaylistTrack } from "@sdk";

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

	toResponse(): PlaylistTrackResponse | null {
		if (!this.track) {
			return null;
		}

		return {
			track: this.track.toResponse(),
			dateAdded: new Date(this.dateAdded),
			addedBySystem: !this.addedByUuid,
			addedBy: this.addedBy?.toResponse() ?? null,
		};
	}

	toSavedResponse(): SavedPlaylistTrack {
		return {
			playlistUuid: this.playlistUuid,
			trackUuid: this.trackUuid,
			dateAdded: new Date(this.dateAdded),
			ordinal: this.ordinal,
			addedByUuid: this.addedByUuid,
			addedBy: this.addedBy?.toSavedResponse() ?? null,
			playlist: this.playlist?.toSavedResponse() ?? null,
			track: this.track?.toSavedResponse() ?? null,
		};
	}
}
