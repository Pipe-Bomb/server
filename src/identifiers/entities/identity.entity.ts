import { DBTrack } from "src/tracks/entities/track.entity";
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { IdentityResponse } from "../response/identity.response";
import { Identity } from "@sdk";

// todo: rename to DBTrackIdentity
@Entity("identities")
@Index(["trackUuid"])
export class DBIdentity {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	identifierId: string;

	@PrimaryColumn({ type: "uuid" })
	trackUuid: string;

	@PrimaryColumn({
		type: "integer",
		default: 0,
	})
	ordinal: number;

	@ManyToOne(() => DBTrack, (track) => track.identities)
	@JoinColumn({ name: "trackUuid" })
	track?: DBTrack;

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
