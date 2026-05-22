import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { DBArtistIdentity } from "./artist-identity.entity";
import { DBTrackArtist } from "./track-artist.entity";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { ArtistResponse } from "../response/artist.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "src/tracks/response/track.response";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { AlbumResponse } from "src/albums/response/album.response";

@Entity("artists")
export class DBArtist {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@OneToMany(() => DBArtistIdentity, (identity) => identity.artist)
	identities?: DBArtistIdentity[];

	@OneToMany(() => DBArtistAttribute, (attribute) => attribute.entityRelationId)
	attributes?: DBArtistAttribute[];

	@OneToMany(() => DBTrackArtist, (track) => track.artist)
	tracks?: DBTrackArtist[];

	@OneToMany(() => DBAlbumArtist, (album) => album.artist)
	albums?: DBAlbumArtist[];

	@CreateDateColumn({
		type: "integer",
	})
	dateAdded: number;

	@Column({
		type: "uuid",
		nullable: true,
	})
	lastIdentificationRunId: string | null;

	toResponse(): ArtistResponse {
		let identities: IdentityResponse[] | null = null;
		if (this.identities) {
			identities = this.identities.map((identity) => identity.toResponse());
		}

		let tracks: TrackResponse[] | null = null;
		if (this.tracks) {
			tracks = this.tracks
				.filter((artist) => artist.track)
				.map(({ track }) => track!.toResponse());
		}

		let albums: AlbumResponse[] | null = null;
		if (this.albums) {
			albums = this.albums
				.filter((artist) => artist.album)
				.map(({ album }) => album!.toResponse());
		}

		return {
			uuid: this.uuid,
			attributes: this.attributes ?? null,
			identities,
			tracks,
			albums,
		};
	}
}
