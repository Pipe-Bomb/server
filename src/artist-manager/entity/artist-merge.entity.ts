import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("artist_merges")
@Index(["masterUuid"])
export class DBArtistMerge {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({ type: "uuid" })
	mergedUuid: string;

	@Column({ type: "uuid" })
	masterUuid: string;

	@Column({ type: "integer" })
	mergedAt: number;
}
