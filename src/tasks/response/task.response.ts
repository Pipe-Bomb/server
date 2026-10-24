import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TaskHistoryResponse } from "./task-history.response";

export enum TaskStatusResponse {
	STOPPED = "stopped",
	SUSPENDED = "suspended",
	RUNNING = "running",
}

@ApiSchema({ name: "Task" })
export class TaskResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		nullable: true,
		type: String,
	})
	pluginId: string | null;

	@ApiProperty()
	taskId: string;

	@ApiProperty({
		type: [String],
		nullable: true,
	})
	subTasks: string[] | null;

	@ApiProperty({
		enum: TaskStatusResponse,
	})
	status: TaskStatusResponse;

	@ApiProperty({
		minimum: 0,
		maximum: 100,
		nullable: true,
		type: "number",
	})
	percent: number | null;

	@ApiProperty()
	resumable: boolean;

	@ApiProperty({
		type: TaskHistoryResponse,
		nullable: true,
	})
	lastRun: TaskHistoryResponse | null;
}
