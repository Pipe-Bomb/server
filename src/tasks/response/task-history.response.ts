import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TaskHistoryResult } from "../enum/task-history-result.enum";

@ApiSchema({ name: "TaskHistory" })
export class TaskHistoryResponse {
	@ApiProperty({
		enum: TaskHistoryResult,
		enumName: "TaskHistoryResult",
	})
	result: TaskHistoryResult;

	@ApiProperty({
		type: "integer",
		description: "Duration in milliseconds",
	})
	duration: number;

	@ApiProperty({
		type: Date,
	})
	dateStarted: Date;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	subTaskId: string | null;
}
