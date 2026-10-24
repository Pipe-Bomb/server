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
		const tasks = this.tasksService.allTasks();
		const responses = await this.tasksService.toResponse(tasks);

		return {
			pluginTasks: responses.filter((_, index) => tasks[index].plugin),
			systemTasks: responses.filter((_, index) => !tasks[index].plugin),
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
