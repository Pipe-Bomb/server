import { Controller, Get, UseGuards } from "@nestjs/common";
import { WorkflowsService } from "./workflows.service";
import {
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "src/user-manager/auth.guard";
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
	getAllSteps(): WorkflowStepDefinitionResponse[] {
		const triggers = this.workflowsService.allSteps();
		return triggers.map((trigger) => workflowStepToResponse(trigger));
	}
}
