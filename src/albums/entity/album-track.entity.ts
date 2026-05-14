import { DBTrack } from "src/tracks/entities/track.entity";
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { DBAlbum } from "./album.entity";

@Entity("album_tracks")
export class DBAlbumTrack {
	@PrimaryColumn({ type: "uuid" })
	albumUuid: string;

	@PrimaryColumn({ type: "uuid" })
	trackUuid: string;

	@Column({ type: "integer", default: 1 })
	discNumber: number;

	@Column({ type: "integer", default: 0 })
	trackNumber: number;

	@PrimaryColumn({ type: "text" })
	pluginId: string;

	@PrimaryColumn({ type: "text" })
	identifierId: string;

	@ManyToOne(() => DBAlbum, (album) => album.tracks, { onDelete: "CASCADE" })
	@JoinColumn({ name: "albumUuid" })
	album?: DBAlbum;

	@ManyToOne(() => DBTrack, (track) => track.albums, { onDelete: "CASCADE" })
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;
}
