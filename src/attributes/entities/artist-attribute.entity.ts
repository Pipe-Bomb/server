import { Entity, ManyToOne } from "typeorm";
import { DBAttributeTemplate } from "./attribute.entity-template";
import { DBArtist } from "src/artists/entity/artist.entity";

@Entity("artist_attributes")
export class DBArtistAttribute extends DBAttributeTemplate {
	@ManyToOne(() => DBArtist, (artist) => artist.attributes)
	entityRelationId: string;
}
