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
import { toSimplifiedAttributeList } from "src/attributes/attributes.util";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "src/tracks/response/track.response";
import { BasePersistentAttributeResponse } from "src/attributes/response/persistent-attribute.response";

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

		return {
			uuid: this.uuid,
			attributes: this.attributes ?? null,
			identities,
			tracks,
		};
	}
}
