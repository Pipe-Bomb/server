import { Entity, ManyToOne } from "typeorm";
import { DBAttributeTemplate } from "./attribute.entity-template";
import { DBAlbum } from "src/albums/entity/album.entity";

@Entity("album_attributes")
export class DBAlbumAttribute extends DBAttributeTemplate {
	@ManyToOne(() => DBAlbum, (album) => album.attributes)
	entityRelationId: string;
}
