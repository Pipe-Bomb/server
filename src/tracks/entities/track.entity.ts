import {
	Column,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";
import { TrackResponse } from "../response/track.response";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { DBIdentity } from "src/identifiers/entities/identity.entity";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { DBTrackArtist } from "../../artist-manager/entity/track-artist.entity";
import { TrackArtistResponse } from "../response/track-artist.response";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { AlbumResponse } from "src/albums/response/album.response";

@Entity("tracks")
@Unique("IDX_pluginId_libraryId_trackId", ["pluginId", "libraryId", "trackId"])
export class DBTrack {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "text",
	})
	pluginId: string;

	@Column({
		type: "text",
	})
	libraryId: string;

	@Column({
		type: "text",
	})
	trackId: string;

	@Column({
		type: "text",
	})
	title: string;

	@Column({
		type: "uuid",
		nullable: true,
	})
	lastScanRunId: string | null;

	@Column({
		type: "uuid",
		nullable: true,
	})
	lastIdentificationRunId: string | null;

	@Column({
		type: "uuid",
		nullable: true,
	})
	lastAttributionRunId: string | null;

	@OneToMany(() => DBTrackArtist, (artist) => artist.track)
	artists?: DBTrackArtist[];

	@OneToMany(() => DBTrackAttribute, (attribute) => attribute.entityRelationId)
	attributes?: DBTrackAttribute[];

	@OneToMany(() => DBIdentity, (identity) => identity.track)
	identities?: DBIdentity[];

	@OneToMany(() => DBAlbumTrack, (album) => album.track)
	albums?: DBAlbumTrack[];

	toResponse(
		options: {
			identities?: DBIdentity[];
		} = {},
	): TrackResponse {
		let identities: IdentityResponse[] | null = null;
		if (options.identities) {
			identities = options.identities.map((identity) => identity.toResponse());
		} else if (this.identities) {
			identities = this.identities.map((identity) => identity.toResponse());
		}

		const artistMap: Record<string, DBTrackArtist> = {};

		if (this.artists) {
			for (const trackArtist of this.artists) {
				if (!trackArtist.artist) {
					continue;
				}
				const existing = artistMap[trackArtist.artist.uuid];
				if (existing) {
					if (existing.joinPhrase && !trackArtist.joinPhrase) {
						continue;
					}
				}
				artistMap[trackArtist.artist.uuid] = trackArtist;
			}
		}

		const artists: TrackArtistResponse[] = [];
		for (const trackArtist of Object.values(artistMap)) {
			const artist = trackArtist.toResponse();
			if (artist) {
				artists.push(artist);
			}
		}

		const albumMap: Record<string, DBAlbumTrack> = {};

		if (this.albums) {
			for (const albumTrack of this.albums) {
				if (!albumTrack.album) {
					continue;
				}
				albumMap[albumTrack.album.uuid] = albumTrack;
			}
		}

		const albums: AlbumResponse[] = [];
		for (const albumTrack of Object.values(albumMap)) {
			const album = albumTrack.album?.toResponse();
			if (album) {
				albums.push(album);
			}
		}

		return {
			trackId: this.trackId,
			pluginId: this.pluginId,
			libraryId: this.libraryId,
			title: this.title,
			attributes: this.attributes ?? null,
			identities,
			artists: (this.artists && artists) ?? null,
			albums: (this.albums && albums) ?? null,
		};
	}
}
