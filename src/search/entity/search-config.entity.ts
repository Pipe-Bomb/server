import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("search_config")
export class DBSearchConfig {
	@PrimaryColumn({ type: "int" })
	id: number = 1;

	@Column({ type: "text", nullable: true })
	activePluginId: string | null = null;

	@Column({ type: "text", nullable: true })
	activeSourceId: string | null = null;
}
