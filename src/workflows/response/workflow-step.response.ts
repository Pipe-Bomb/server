import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { WorkflowStepType } from "../enum/workflow-step-type.enum";
import {
	StringWorkflowStepOptionValueResponse,
	BooleanWorkflowStepOptionValueResponse,
	IntegerWorkflowStepOptionValueResponse,
	DecimalWorkflowStepOptionValueResponse,
	EnumWorkflowStepOptionValueResponse,
	WorkflowStepOptionValueResponse,
} from "./workflow-step-option-value.response";
import { WorkflowStepOptionType } from "../enum/workflow-step-option-type.enum";

@ApiSchema({ name: "WorkflowStep" })
@ApiExtraModels(
	StringWorkflowStepOptionValueResponse,
	BooleanWorkflowStepOptionValueResponse,
	IntegerWorkflowStepOptionValueResponse,
	DecimalWorkflowStepOptionValueResponse,
	EnumWorkflowStepOptionValueResponse,
)
export class WorkflowStepResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	workflowUuid: string;

	@ApiProperty({
		enum: WorkflowStepType,
		enumName: "WorkflowStepType",
	})
	stepType: WorkflowStepType;

	@ApiProperty({
		type: "string",
		nullable: true,
	})
	pluginId: string | null;

	@ApiProperty()
	stepId: string;

	@ApiProperty()
	loaded: boolean;

	@ApiProperty({
		nullable: true,
		isArray: true,
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringWorkflowStepOptionValueResponse) },
				{ $ref: getSchemaPath(BooleanWorkflowStepOptionValueResponse) },
				{ $ref: getSchemaPath(IntegerWorkflowStepOptionValueResponse) },
				{ $ref: getSchemaPath(DecimalWorkflowStepOptionValueResponse) },
				{ $ref: getSchemaPath(EnumWorkflowStepOptionValueResponse) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[WorkflowStepOptionType.STRING]: getSchemaPath(
						StringWorkflowStepOptionValueResponse,
					),
					[WorkflowStepOptionType.BOOLEAN]: getSchemaPath(
						BooleanWorkflowStepOptionValueResponse,
					),
					[WorkflowStepOptionType.INTEGER]: getSchemaPath(
						IntegerWorkflowStepOptionValueResponse,
					),
					[WorkflowStepOptionType.DECIMAL]: getSchemaPath(
						DecimalWorkflowStepOptionValueResponse,
					),
					[WorkflowStepOptionType.ENUM]: getSchemaPath(
						EnumWorkflowStepOptionValueResponse,
					),
				},
			},
		},
	})
	options: WorkflowStepOptionValueResponse[] | null;
}
