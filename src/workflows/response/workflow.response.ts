import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { WorkflowStepResponse } from "./workflow-step.response";

@ApiSchema({ name: "Workflow" })
export class WorkflowResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	name: string;

	@ApiProperty({
		type: Date,
	})
	dateCreated: Date;

	@ApiProperty({
		type: [WorkflowStepResponse],
		nullable: true,
	})
	steps: WorkflowStepResponse[] | null;
}
