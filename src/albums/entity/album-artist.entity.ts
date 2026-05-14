import { DBArtist } from "src/artists/entity/artist.entity";
import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from "typeorm";
import { DBAlbum } from "./album.entity";
import { AlbumArtistResponse } from "../response/album-artist.response";

@Entity("album_artists")
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
}
