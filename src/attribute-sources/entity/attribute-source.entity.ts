import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("attribute_sources")
export class DBAttributeSource {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string;

	@PrimaryColumn({
		type: "text",
	})
	sourceId: string;

	@Column({
		type: "boolean",
	})
	disabled: boolean;

	@Column({
		type: "int",
	})
	priority: number | null;
}
