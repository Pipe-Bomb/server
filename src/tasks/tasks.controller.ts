import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from "@nestjs/common";
import { TasksService } from "./tasks.service";
import {
	ApiConflictResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
} from "@nestjs/swagger";
import { AllTasksResponse } from "./response/all-tasks.response";

@Controller("tasks")
export class TasksController {
	constructor(private readonly tasksService: TasksService) {}

	@Get()
	@ApiOperation({ operationId: "getTasks" })
	@ApiOkResponse({
		type: AllTasksResponse,
	})
	all() {
		const pluginTasks = this.tasksService.allPluginTasks();
		const systemTasks = this.tasksService.allSystemTasks();

		return {
			pluginTasks: pluginTasks.map((task) =>
				this.tasksService.toResponse(task),
			),
			systemTasks: systemTasks.map((task) =>
				this.tasksService.toResponse(task),
			),
		};
	}

	@Post(":taskUuid/start")
	@ApiOperation({ operationId: "startTask" })
	@ApiNotFoundResponse()
	@ApiConflictResponse()
	@ApiNoContentResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	start(@Param("taskUuid") taskUuid: string) {
		this.tasksService.runTask(taskUuid);
	}
}
