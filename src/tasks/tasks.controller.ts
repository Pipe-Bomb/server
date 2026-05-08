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
import { LoadedTask } from "./interface/loaded-task.interface";

@Controller("tasks")
export class TasksController {
	constructor(private readonly tasksService: TasksService) {}

	@Get()
	@ApiOperation({ operationId: "getTasks" })
	@ApiOkResponse({
		type: AllTasksResponse,
	})
	async all() {
		const pluginTasks = this.tasksService.allPluginTasks();
		const systemTasks = this.tasksService.allSystemTasks();
		const progresses = await this.tasksService.allResumableProgresses();

		const getProgress = (task: LoadedTask) =>
			progresses.find(
				(progress) =>
					progress.taskId == task.task.id &&
					(task.plugin
						? task.plugin.package.name == progress.pluginId
						: !progress.pluginId),
			) ?? null;

		return {
			pluginTasks: pluginTasks.map((task) =>
				this.tasksService.toResponse(task, getProgress(task)),
			),
			systemTasks: systemTasks.map((task) =>
				this.tasksService.toResponse(task, getProgress(task)),
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
