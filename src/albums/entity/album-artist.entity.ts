import { DBArtist } from "src/artist-manager/entity/artist.entity";
import {
	Entity,
	PrimaryColumn,
	ManyToOne,
	JoinColumn,
	Column,
	Index,
} from "typeorm";
import { DBAlbum } from "./album.entity";
import { AlbumArtistResponse } from "../response/album-artist.response";
import { SavedAlbumArtist } from "sdk/database";

@Entity("album_artists")
@Index(["albumUuid"])
@Index(["artistUuid"])
export class DBAlbumArtist {
	@PrimaryColumn({ type: "uuid" })
	albumUuid: string;

	@PrimaryColumn({ type: "uuid" })
	artistUuid: string;

	@PrimaryColumn({ type: "integer", default: 0 })
	ordinal: number;

	@PrimaryColumn({ type: "text" })
	pluginId: string;

	@PrimaryColumn({ type: "text" })
	identifierId: string;

	@ManyToOne(() => DBAlbum, { onDelete: "CASCADE" })
	@JoinColumn({ name: "albumUuid" })
	album?: DBAlbum;

	@ManyToOne(() => DBArtist, { onDelete: "CASCADE" })
	@JoinColumn({ name: "artistUuid" })
	artist?: DBArtist;

	@Column({ type: "text", nullable: true })
	joinPhrase: string | null;

	toResponse(): AlbumArtistResponse | null {
		if (!this.artist) {
			return null;
		}

		return {
			artistUuid: this.artistUuid,
			joinPhrase: this.joinPhrase,
			artist: this.artist.toResponse(),
		};
	}

	toSavedResponse(): SavedAlbumArtist {
		return {
			artistUuid: this.artistUuid,
			albumUuid: this.albumUuid,
			pluginId: this.pluginId,
			identifierId: this.identifierId,
			ordinal: this.ordinal,
			joinPhrase: this.joinPhrase,
			artist: this.artist?.toSavedResponse() ?? null,
			album: this.album?.toSavedResponse() ?? null,
		};
	}
}
