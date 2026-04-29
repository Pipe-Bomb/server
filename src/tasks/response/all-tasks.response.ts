import { ApiProperty } from "@nestjs/swagger";
import { TaskResponse } from "./task.response";

export class AllTasksResponse {
	@ApiProperty({
		type: [TaskResponse],
	})
	pluginTasks: TaskResponse[];

	@ApiProperty({
		type: [TaskResponse],
	})
	systemTasks: TaskResponse[];
}
