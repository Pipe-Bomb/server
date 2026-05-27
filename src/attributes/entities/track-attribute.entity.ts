import { Entity, ManyToOne } from "typeorm";
import { DBAttributeTemplate } from "./attribute.entity-template";
import { DBTrack } from "src/tracks/entities/track.entity";

@Entity("track_attributes")
export class DBTrackAttribute extends DBAttributeTemplate {
	@ManyToOne(() => DBTrack, (track) => track.attributes, {
		onDelete: "CASCADE",
	})
	entityRelationId: string;
}
