import { Identity } from "@sdk";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { DBAlbum } from "./album.entity";

@Entity("album_identities")
export class DBAlbumIdentity {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	identifierId: string;

	@PrimaryColumn({ type: "uuid" })
	albumUuid: string;

	@ManyToOne(() => DBAlbum, (album) => album.identities)
	@JoinColumn({ name: "albumUuid" })
	album?: DBAlbum;

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
			entityId: this.albumUuid,
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
