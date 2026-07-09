import {
	Equals,
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsString,
	ValidateIf,
} from "class-validator";
import { WorkflowStepOptionType } from "../enum/workflow-step-option-type.enum";
import { ApiProperty } from "@nestjs/swagger";

class BaseWorkflowStepOptionValueDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	id: string;
}

export class StringWorkflowStepOptionValueDto extends BaseWorkflowStepOptionValueDto {
	@ApiProperty({
		enum: [WorkflowStepOptionType.STRING],
	})
	@Equals(WorkflowStepOptionType.STRING)
	type: WorkflowStepOptionType.STRING;

	@ValidateIf((_, value) => value !== null)
	@IsString()
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	value: string | null;
}

export class EnumWorkflowStepOptionValueDto extends BaseWorkflowStepOptionValueDto {
	@ApiProperty({
		enum: [WorkflowStepOptionType.ENUM],
	})
	@Equals(WorkflowStepOptionType.ENUM)
	type: WorkflowStepOptionType.ENUM;

	@ValidateIf((_, value) => value !== null)
	@IsString()
	@ApiProperty({
		type: "string",
		nullable: true,
	})
	value: string | null;
}

export class BooleanWorkflowStepOptionValueDto extends BaseWorkflowStepOptionValueDto {
	@ApiProperty({
		enum: [WorkflowStepOptionType.BOOLEAN],
	})
	@Equals(WorkflowStepOptionType.BOOLEAN)
	type: WorkflowStepOptionType.BOOLEAN;

	@ValidateIf((_, value) => value !== null)
	@IsBoolean()
	@ApiProperty({
		type: "boolean",
		nullable: true,
	})
	value: boolean | null;
}

export class IntegerWorkflowStepOptionValueDto extends BaseWorkflowStepOptionValueDto {
	@ApiProperty({
		enum: [WorkflowStepOptionType.INTEGER],
	})
	@Equals(WorkflowStepOptionType.INTEGER)
	type: WorkflowStepOptionType.INTEGER;

	@ValidateIf((_, value) => value !== null)
	@IsInt()
	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	value: number | null;
}

export class DecimalWorkflowStepOptionValueDto extends BaseWorkflowStepOptionValueDto {
	@ApiProperty({
		enum: [WorkflowStepOptionType.DECIMAL],
	})
	@Equals(WorkflowStepOptionType.DECIMAL)
	type: WorkflowStepOptionType.DECIMAL;

	@ValidateIf((_, value) => value !== null)
	@IsNumber()
	@ApiProperty({
		type: "number",
		nullable: true,
	})
	value: number | null;
}

export type WorkflowStepOptionValueDto =
	| StringWorkflowStepOptionValueDto
	| EnumWorkflowStepOptionValueDto
	| BooleanWorkflowStepOptionValueDto
	| IntegerWorkflowStepOptionValueDto
	| DecimalWorkflowStepOptionValueDto;
