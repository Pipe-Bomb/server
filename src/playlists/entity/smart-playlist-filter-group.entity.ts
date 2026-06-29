import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { DBPlaylist } from "./playlist.entity";
import { DBSmartPlaylistFilter } from "./smart-playlist-filter.entity";
import { SmartPlaylistFilterGroupResponse } from "../response/smart-playlist-filter-group.reponse";
import { SavedSmartFilter, SavedSmartFilterGroup } from "@sdk";

@Entity("smart_playlist_filter_groups")
export class DBSmartPlaylistFilterGroup {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@CreateDateColumn({
		type: "integer",
	})
	dateCreated: number;

	@Column({
		type: "uuid",
	})
	playlistUuid: string;

	@ManyToOne(() => DBPlaylist, (playlist) => playlist.filterGroups, {
		onDelete: "CASCADE",
	})
	@JoinColumn({ name: "playlistUuid" })
	playlist?: DBPlaylist;

	@OneToMany(() => DBSmartPlaylistFilter, (filter) => filter.group)
	filters?: DBSmartPlaylistFilter[];

	toResponse(): SmartPlaylistFilterGroupResponse {
		if (!this.filters) {
			throw new Error("Filters not loaded");
		}

		return {
			uuid: this.uuid,
			dateCreated: new Date(this.dateCreated),
			filters: this.filters.map((filter) => filter.toResponse()),
		};
	}

	toSavedResponse(): SavedSmartFilterGroup {
		return {
			uuid: this.uuid,
			filters: this.filters?.map((filter) => filter.toSavedResponse()) ?? null,
			dateCreated: new Date(this.dateCreated),
		};
	}
}
