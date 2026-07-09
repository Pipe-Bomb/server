import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { WorkflowStepType } from "../enum/workflow-step-type.enum";

@ApiSchema({ name: "WorkflowStepDefinition" })
export class WorkflowStepDefinitionResponse {
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	pluginId: string | null;

	@ApiProperty()
	stepId: string;

	@ApiProperty({
		enum: WorkflowStepType,
		enumName: "WorkflowStepType",
	})
	stepType: WorkflowStepType;
}
