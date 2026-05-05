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

@Entity("artist_identities")
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
			entityId: this.artistUuid,
			value: this.identity,
			ordinal: this.ordinal,
		};
	}

	toIdentity(): Identity {
		return {
			identifierId: this.identifierId,
			pluginId: this.pluginId,
			value: this.identity,
		};
	}
}
