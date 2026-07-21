import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Patch,
	Post,
	Put,
} from "@nestjs/common";
import { WorkflowsService } from "./workflows.service";
import { WorkflowResponse } from "./response/workflow.response";
import {
	ApiConflictResponse,
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateWorkflowDto } from "./dto/create-workflow.dto";
import { AddWorkflowStepDto } from "./dto/add-workflow-step.dto";
import { UpdateWorkflowStepOptionsDto } from "./dto/update-workflow-step-options.dto";
import { PrivilegesService } from "src/privileges/privileges.service";
import { Privileges } from "src/privileges/privileges.decorator";

@Controller("workflows")
export class WorkflowsController {
	constructor(
		private readonly workflowsService: WorkflowsService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(null, "edit-workflows");
		this.privilegesService.registerPrivilege(null, "view-workflows", [
			"edit-workflows",
		]);
	}

	@ApiOperation({
		operationId: "getAllWorkflows",
	})
	@ApiOkResponse({
		type: [WorkflowResponse],
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@Get()
	@Privileges("view-workflows")
	async getAll(): Promise<WorkflowResponse[]> {
		const workflows = await this.workflowsService.all();
		return workflows.map((workflow) =>
			workflow.toResponse(
				this.workflowsService.allStepsAndTriggers(),
				this.workflowsService.getActive(workflow.uuid),
			),
		);
	}

	@ApiOperation({
		operationId: "getWorkflow",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	@Get(":uuid")
	@Privileges("view-workflows")
	async getWorkflow(@Param("uuid") uuid: string): Promise<WorkflowResponse> {
		const workflow = await this.workflowsService.findOne(uuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}

	@ApiOperation({
		operationId: "createWorkflow",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@Put()
	@Privileges("edit_workflows")
	async createWorkflow(@Body() dto: CreateWorkflowDto) {
		const workflow = await this.workflowsService.create(dto.name);
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}

	@ApiOperation({
		operationId: "deleteWorkflow",
	})
	@ApiNoContentResponse()
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	@Delete(":uuid")
	@Privileges("edit_workflows")
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteWorkflow(@Param("uuid") uuid: string) {
		const workflow = await this.workflowsService.findOne(uuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		await this.workflowsService.delete(workflow);
	}

	@ApiOperation({
		operationId: "addWorkflowTrigger",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiConflictResponse()
	@ApiNotFoundResponse()
	@Put(":uuid/trigger")
	@Privileges("edit_workflows")
	async addTrigger(
		@Param("uuid") uuid: string,
		@Body() dto: AddWorkflowStepDto,
	) {
		const triggers = this.workflowsService.allTriggers();
		const trigger = triggers.find(
			({ plugin, object }) =>
				(plugin?.package.name ?? null) == dto.pluginId &&
				object.id == dto.stepId,
		);
		if (!trigger) {
			throw new NotFoundException("Trigger not found");
		}

		await this.workflowsService.addTrigger(uuid, trigger);
		const workflow = await this.workflowsService.findOne(uuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}

	@ApiOperation({
		operationId: "addWorkflowStep",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiConflictResponse()
	@ApiNotFoundResponse()
	@Post(":uuid/step")
	@Privileges("edit_workflows")
	@HttpCode(HttpStatus.OK)
	async addStep(@Param("uuid") uuid: string, @Body() dto: AddWorkflowStepDto) {
		const steps = this.workflowsService.allSteps();
		const step = steps.find(
			({ plugin, object }) =>
				(plugin?.package.name ?? null) == dto.pluginId &&
				object.id == dto.stepId,
		);
		if (!step) {
			throw new NotFoundException("Step not found");
		}

		await this.workflowsService.addStep(uuid, step);
		const workflow = await this.workflowsService.findOne(uuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}

	@ApiOperation({
		operationId: "deleteWorkflowStep",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	@Delete(":workflowUuid/step/:stepUuid")
	@Privileges("edit_workflows")
	async deleteStep(
		@Param("workflowUuid") workflowUuid: string,
		@Param("stepUuid") stepUuid: string,
	): Promise<WorkflowResponse> {
		await this.workflowsService.removeStep(stepUuid, workflowUuid);
		const workflow = await this.workflowsService.findOne(workflowUuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}

	@ApiOperation({
		operationId: "updateWorkflowStepOptions",
	})
	@ApiOkResponse({
		type: WorkflowResponse,
	})
	@ApiForbiddenResponse()
	@ApiUnauthorizedResponse()
	@ApiNotFoundResponse()
	@Patch(":workflowUuid/step/:stepUuid")
	@Privileges("edit_workflows")
	async updateStepOptions(
		@Param("workflowUuid") workflowUuid: string,
		@Param("stepUuid") stepUuid: string,
		@Body() dto: UpdateWorkflowStepOptionsDto,
	): Promise<WorkflowResponse> {
		const step = await this.workflowsService.findStep(stepUuid);
		if (!step) {
			throw new NotFoundException("Step not found");
		}
		if (step.workflowUuid != workflowUuid) {
			throw new BadRequestException("Step does not belong to workflow");
		}

		await this.workflowsService.updateStepOptions(step, dto.options);
		const workflow = await this.workflowsService.findOne(step.workflowUuid);
		if (!workflow) {
			throw new NotFoundException("Workflow not found");
		}
		return workflow.toResponse(
			this.workflowsService.allStepsAndTriggers(),
			this.workflowsService.getActive(workflow.uuid),
		);
	}
}
