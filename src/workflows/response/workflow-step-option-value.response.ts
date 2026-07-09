import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { WorkflowStepOptionType } from "../enum/workflow-step-option-type.enum";

export class BaseWorkflowStepOptionValueResponse {
	@ApiProperty()
	id: string;

	@ApiProperty({
		enum: WorkflowStepOptionType,
	})
	type: WorkflowStepOptionType;
}

@ApiSchema({ name: "StringWorkflowStepOptionValue" })
export class StringWorkflowStepOptionValueResponse extends BaseWorkflowStepOptionValueResponse {
	@ApiProperty({ enum: [WorkflowStepOptionType.STRING] })
	override type = WorkflowStepOptionType.STRING;

	@ApiProperty({
		type: "string",
		nullable: true,
	})
	value: string | null;
}

@ApiSchema({ name: "BooleanWorkflowStepOptionValue" })
export class BooleanWorkflowStepOptionValueResponse extends BaseWorkflowStepOptionValueResponse {
	@ApiProperty({ enum: [WorkflowStepOptionType.BOOLEAN] })
	override type = WorkflowStepOptionType.BOOLEAN;

	@ApiProperty({
		type: "boolean",
		nullable: true,
	})
	value: boolean | null;
}

@ApiSchema({ name: "IntegerWorkflowStepOptionValue" })
export class IntegerWorkflowStepOptionValueResponse extends BaseWorkflowStepOptionValueResponse {
	@ApiProperty({ enum: [WorkflowStepOptionType.INTEGER] })
	override type = WorkflowStepOptionType.INTEGER;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	value: number | null;
}

@ApiSchema({ name: "DecimalWorkflowStepOptionValue" })
export class DecimalWorkflowStepOptionValueResponse extends BaseWorkflowStepOptionValueResponse {
	@ApiProperty({ enum: [WorkflowStepOptionType.DECIMAL] })
	override type = WorkflowStepOptionType.DECIMAL;

	@ApiProperty({
		type: "number",
		nullable: true,
	})
	value: number | null;
}

@ApiSchema({ name: "WorkspaceStepOptionEnumItem" })
export class WorkspaceStepOptionEnumItem {
	@ApiProperty()
	id: string;

	@ApiProperty({
		type: "string",
		nullable: true,
	})
	name: string | null;

	@ApiProperty({
		type: "string",
		nullable: true,
	})
	languageKey: string | null;
}

@ApiSchema({ name: "EnumWorkflowStepOptionValue" })
export class EnumWorkflowStepOptionValueResponse extends BaseWorkflowStepOptionValueResponse {
	@ApiProperty({ enum: [WorkflowStepOptionType.ENUM] })
	override type = WorkflowStepOptionType.ENUM;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	value: string | null;

	@ApiProperty({
		type: [WorkspaceStepOptionEnumItem],
	})
	options: WorkspaceStepOptionEnumItem[];
}

export type WorkflowStepOptionValueResponse =
	| StringWorkflowStepOptionValueResponse
	| BooleanWorkflowStepOptionValueResponse
	| IntegerWorkflowStepOptionValueResponse
	| DecimalWorkflowStepOptionValueResponse
	| EnumWorkflowStepOptionValueResponse;
