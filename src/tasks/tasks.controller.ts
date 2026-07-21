import {
	Body,
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
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AllTasksResponse } from "./response/all-tasks.response";
import { LoadedTask } from "./interface/loaded-task.interface";
import { StartTaskDto } from "./dto/start-task.dto";
import { Privileges } from "src/privileges/privileges.decorator";
import { PrivilegesService } from "src/privileges/privileges.service";

@Controller("tasks")
export class TasksController {
	constructor(
		private readonly tasksService: TasksService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(null, "run-tasks");
		this.privilegesService.registerPrivilege(null, "view-tasks", ["run-tasks"]);
	}

	@Get()
	@Privileges("view-tasks")
	@ApiOperation({ operationId: "getTasks" })
	@ApiOkResponse({
		type: AllTasksResponse,
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
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
	@Privileges("run-tasks")
	@ApiOperation({ operationId: "startTask" })
	@ApiNotFoundResponse()
	@ApiConflictResponse()
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	async start(@Param("taskUuid") taskUuid: string, @Body() dto: StartTaskDto) {
		await this.tasksService.runTask(taskUuid, dto.subTask);
	}
}
