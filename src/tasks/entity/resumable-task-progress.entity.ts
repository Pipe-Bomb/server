import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("resumable-task-progress")
export class DBResumableTaskProgress {
	@PrimaryColumn({
		type: "text",
	})
	pluginId: string; // empty string means system task

	@PrimaryColumn({
		type: "text",
	})
	taskId: string;

	@PrimaryColumn({
		type: "uuid",
	})
	@Index({
		unique: true,
	})
	runId: string;

	@Column({
		type: "text",
		nullable: true,
	})
	subTaskId: string | null;

	@Column({
		type: "double precision",
	})
	progress: number;
}
