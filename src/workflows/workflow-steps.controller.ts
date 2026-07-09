import { Controller, Get, UseGuards } from "@nestjs/common";
import { WorkflowsService } from "./workflows.service";
import {
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "src/users/auth.guard";
import { workflowStepToResponse } from "./workflows.util";
import { WorkflowStepDefinitionResponse } from "./response/step-declaration.response";

@Controller("workflow-steps")
export class WorkflowStepsController {
	constructor(private readonly workflowsService: WorkflowsService) {}

	@ApiOperation({
		operationId: "getAllWorkflowTriggers",
	})
	@ApiOkResponse({
		type: [WorkflowStepDefinitionResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@Get("triggers")
	@UseGuards(AuthGuard)
	getAllTriggers(): WorkflowStepDefinitionResponse[] {
		const triggers = this.workflowsService.allTriggers();
		return triggers.map((trigger) => workflowStepToResponse(trigger));
	}

	@ApiOperation({
		operationId: "getAllWorkflowSteps",
	})
	@ApiOkResponse({
		type: [WorkflowStepDefinitionResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@Get("steps")
	@UseGuards(AuthGuard)
	getAllSteps(): WorkflowStepDefinitionResponse[] {
		const triggers = this.workflowsService.allSteps();
		return triggers.map((trigger) => workflowStepToResponse(trigger));
	}
}
