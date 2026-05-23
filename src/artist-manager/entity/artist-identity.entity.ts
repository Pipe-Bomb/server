import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBArtist } from "./artist.entity";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { Identity } from "@sdk";
import { ArtistIdentityTarget } from "../../artist-manager/enum/artist-identity-target.enum";

@Entity("artist_identities")
@Index(["artistUuid"])
export class DBArtistIdentity {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	identifierId: string;

	@PrimaryColumn({ type: "uuid" })
	artistUuid: string;

	@PrimaryColumn({
		type: "text",
		enum: ArtistIdentityTarget,
	})
	target: ArtistIdentityTarget;

	@ManyToOne(() => DBArtist, (artist) => artist.identities)
	@JoinColumn({ name: "artistUuid" })
	artist?: DBArtist;

	@PrimaryColumn({
		type: "integer",
		default: 0,
	})
	ordinal: number;

	@Column({
		type: "text",
	})
	@Index()
	identity: string;

	toResponse(): IdentityResponse {
		return {
			pluginId: this.pluginId,
			identityId: this.identifierId,
			value: this.identity,
			ordinal: this.ordinal,
		};
	}

	toIdentity(): Identity {
		return {
			identityId: this.identifierId,
			pluginId: this.pluginId,
			identity: this.identity,
		};
	}
}
