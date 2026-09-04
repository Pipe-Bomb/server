import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("album_merges")
@Index(["masterUuid"])
export class DBAlbumMerge {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({ type: "uuid" })
	mergedUuid: string;

	@Column({ type: "uuid" })
	masterUuid: string;

	@Column({ type: "integer" })
	mergedAt: number;
}
