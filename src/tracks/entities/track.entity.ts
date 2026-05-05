import {
	Column,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
	Unique,
} from "typeorm";
import { TrackResponse } from "../response/track.response";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { toSimplifiedAttributeList } from "src/attributes/attributes.util";
import { DBIdentity } from "src/identifiers/entities/identity.entity";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { DBTrackArtist } from "../../artists/entity/track-artist.entity";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import { TrackArtistResponse } from "../response/track-artist.response";
import { BasePersistentAttributeResponse } from "src/attributes/response/persistent-attribute.response";

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

	@OneToMany(() => DBTrackArtist, (artist) => artist.track)
	artists?: DBTrackArtist[];

	@OneToMany(() => DBTrackAttribute, (attribute) => attribute.entityId)
	attributes?: DBTrackAttribute[];

	@OneToMany(() => DBIdentity, (identity) => identity.trackUuid)
	identities?: DBIdentity[];

	toResponse(
		options: {
			identities?: DBIdentity[];
			artists?: DBTrackArtist[];
		} = {},
	): TrackResponse {
		let identities: IdentityResponse[] | null = null;
		if (options.identities) {
			identities = options.identities.map((identity) => identity.toResponse());
		} else if (this.identities) {
			identities = this.identities.map((identity) => identity.toResponse());
		}

		let artists: TrackArtistResponse[] | null = null;
		if (options.artists) {
			artists = options.artists
				.map((artist) => artist.toResponse())
				.filter((a) => !!a);
		} else if (this.artists) {
			artists = this.artists
				.map((artist) => artist.toResponse())
				.filter((a) => !!a);
		}

		return {
			id: this.trackId,
			pluginId: this.pluginId,
			libraryId: this.libraryId,
			title: this.title,
			attributes: this.attributes ?? null,
			identities,
			artists,
		};
	}
}
