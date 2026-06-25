import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	PrimaryColumn,
	Index,
} from "typeorm";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { TrackArtistResponse } from "src/tracks/response/track-artist.response";
import { SavedArtistTrack } from "sdk/database";

@Entity("track_artists")
@Index(["trackUuid", "artistUuid", "pluginId", "identifierId"], {
	unique: true,
})
@Index(["trackUuid"])
@Index(["artistUuid"])
export class DBTrackArtist {
	@PrimaryColumn({ type: "uuid" })
	trackUuid: string;

	@PrimaryColumn({ type: "uuid" })
	artistUuid: string;

	@PrimaryColumn({ type: "integer", default: 0 })
	ordinal: number;

	@PrimaryColumn({ type: "text" })
	pluginId: string;

	@PrimaryColumn({ type: "text" })
	identifierId: string;

	@ManyToOne(() => DBTrack, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

	@ManyToOne(() => DBArtist, { onDelete: "CASCADE" })
	@JoinColumn({ name: "artistUuid" })
	artist?: DBArtist;

	@Column({ type: "text", nullable: true })
	joinPhrase: string | null;

	toResponse(): TrackArtistResponse | null {
		if (!this.artist) {
			return null;
		}

		return {
			artistUuid: this.artistUuid,
			joinPhrase: this.joinPhrase,
			artist: this.artist.toResponse(),
		};
	}

	toSavedResponse(): SavedArtistTrack {
		return {
			artistUuid: this.artistUuid,
			trackUuid: this.trackUuid,
			pluginId: this.pluginId,
			identifierId: this.identifierId,
			ordinal: this.ordinal,
			joinPhrase: this.joinPhrase,
			artist: this.artist?.toSavedResponse() ?? null,
			track: this.track?.toSavedResponse() ?? null,
		};
	}
}
