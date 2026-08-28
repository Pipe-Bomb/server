import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from "typeorm";

@Entity("marketplaces")
export class DBMarketplace {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({ type: "text", unique: true })
	url: string;

	@Column({ type: "text", nullable: true })
	name: string | null;

	@CreateDateColumn({ type: "integer" })
	addedAt: number;
}
