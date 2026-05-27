import { DBPlaylist } from "src/playlists/entity/playlist.entity";
import { Entity, ManyToOne } from "typeorm";
import { DBAttributeTemplate } from "./attribute.entity-template";

@Entity("playlist_attributes")
export class DBPlaylistAttribute extends DBAttributeTemplate {
	@ManyToOne(() => DBPlaylist, (playlist) => playlist.attributes, {
		onDelete: "CASCADE",
	})
	entityRelationId: string;
}
