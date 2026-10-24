import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { TaskHistoryResult } from "../enum/task-history-result.enum";

@Entity("task-history")
@Index("IDX_task_history_latest", [
	"pluginId",
	"taskId",
	"dateStarted",
	"runId",
])
export class DBTaskHistory {
	@PrimaryColumn({
		type: "uuid",
	})
	runId: string;

	@Column({
		type: "text",
	})
	pluginId: string; // empty string means system task

	@Column({
		type: "text",
	})
	taskId: string;

	@Column({
		type: "text",
		nullable: true,
	})
	subTaskId: string | null;

	@Column({
		type: "text",
	})
	result: TaskHistoryResult;

	@Column({
		type: "integer",
	})
	duration: number;

	@Column({
		type: "integer",
	})
	dateStarted: number;
}
