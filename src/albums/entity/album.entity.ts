import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToMany,
	CreateDateColumn,
} from "typeorm";
import { DBAlbumArtist } from "./album-artist.entity";
import { DBAlbumTrack } from "./album-track.entity";
import { DBAlbumIdentity } from "./album-identity.entity";
import { AlbumResponse } from "../response/album.response";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { AlbumArtistResponse } from "../response/album-artist.response";
import { SavedAlbum } from "sdk/database";

@Entity("albums")
export class DBAlbum {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({ type: "text" })
	title: string;

	@OneToMany(() => DBAlbumArtist, (artist) => artist.album, {
		onDelete: "CASCADE",
	})
	artists?: DBAlbumArtist[];

	@OneToMany(() => DBAlbumTrack, (track) => track.album)
	tracks?: DBAlbumTrack[];

	@OneToMany(() => DBAlbumIdentity, (identity) => identity.album)
	identities?: DBAlbumIdentity[];

	@OneToMany(() => DBAlbumAttribute, (attribute) => attribute.entityRelationId)
	attributes?: DBAlbumAttribute[];

	@CreateDateColumn({ type: "integer" })
	dateAdded: number;

	@Column({ type: "uuid", nullable: true })
	lastIdentificationRunId: string | null;

	@Column({
		type: "uuid",
		nullable: true,
	})
	lastAttributionRunId: string | null;

	toResponse(): AlbumResponse {
		const artistMap: Record<string, DBAlbumArtist> = {};

		if (this.artists) {
			for (const albumArtist of this.artists) {
				if (!albumArtist.artist) {
					continue;
				}
				const existing = artistMap[albumArtist.artist.uuid];
				if (existing) {
					if (existing.joinPhrase && !albumArtist.joinPhrase) {
						continue;
					}
				}
				artistMap[albumArtist.artist.uuid] = albumArtist;
			}
		}

		const artists: AlbumArtistResponse[] = [];
		for (const albumArtist of Object.values(artistMap)) {
			const artist = albumArtist.toResponse();
			if (artist) {
				artists.push(artist);
			}
		}

		return {
			uuid: this.uuid,
			tracks:
				this.tracks
					?.map((track) => track.track?.toResponse())
					.filter((track) => !!track) ?? null,
			identities:
				this.identities?.map((identity) => identity.toResponse()) ?? null,
			attributes: this.attributes ?? null,
			artists: this.artists ? artists : null,
		};
	}

	toSavedResponse(): SavedAlbum {
		return {
			uuid: this.uuid,
			dateAdded: new Date(this.dateAdded),
			identities:
				this.identities?.map((identity) => identity.toIdentity()) ?? null,
			attributes:
				this.attributes?.map((attribute) => attribute.toSavedAttribute()) ??
				null,
			tracks: this.tracks?.map((track) => track.toSavedResponse()) ?? null,
			artists: this.artists?.map((artist) => artist.toSavedResponse()) ?? null,
		};
	}
}
