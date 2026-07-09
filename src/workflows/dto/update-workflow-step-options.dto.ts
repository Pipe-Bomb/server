import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { WorkflowStepOptionType } from "../enum/workflow-step-option-type.enum";
import {
	BooleanWorkflowStepOptionValueDto,
	DecimalWorkflowStepOptionValueDto,
	EnumWorkflowStepOptionValueDto,
	IntegerWorkflowStepOptionValueDto,
	StringWorkflowStepOptionValueDto,
	WorkflowStepOptionValueDto,
} from "./workflow-step-option-value.dto";
import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";

@ApiExtraModels(
	StringWorkflowStepOptionValueDto,
	EnumWorkflowStepOptionValueDto,
	BooleanWorkflowStepOptionValueDto,
	IntegerWorkflowStepOptionValueDto,
	DecimalWorkflowStepOptionValueDto,
)
export class UpdateWorkflowStepOptionsDto {
	@ApiProperty({
		type: "array",
		items: {
			oneOf: [
				{ $ref: getSchemaPath(StringWorkflowStepOptionValueDto) },
				{ $ref: getSchemaPath(EnumWorkflowStepOptionValueDto) },
				{ $ref: getSchemaPath(BooleanWorkflowStepOptionValueDto) },
				{ $ref: getSchemaPath(IntegerWorkflowStepOptionValueDto) },
				{ $ref: getSchemaPath(DecimalWorkflowStepOptionValueDto) },
			],
			discriminator: {
				propertyName: "type",
				mapping: {
					[WorkflowStepOptionType.STRING]: getSchemaPath(
						StringWorkflowStepOptionValueDto,
					),
					[WorkflowStepOptionType.ENUM]: getSchemaPath(
						EnumWorkflowStepOptionValueDto,
					),
					[WorkflowStepOptionType.BOOLEAN]: getSchemaPath(
						BooleanWorkflowStepOptionValueDto,
					),
					[WorkflowStepOptionType.INTEGER]: getSchemaPath(
						IntegerWorkflowStepOptionValueDto,
					),
					[WorkflowStepOptionType.DECIMAL]: getSchemaPath(
						DecimalWorkflowStepOptionValueDto,
					),
				},
			},
		},
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => Object, {
		keepDiscriminatorProperty: true,
		discriminator: {
			property: "type",
			subTypes: [
				{
					name: WorkflowStepOptionType.STRING,
					value: StringWorkflowStepOptionValueDto,
				},
				{
					name: WorkflowStepOptionType.ENUM,
					value: EnumWorkflowStepOptionValueDto,
				},
				{
					name: WorkflowStepOptionType.BOOLEAN,
					value: BooleanWorkflowStepOptionValueDto,
				},
				{
					name: WorkflowStepOptionType.INTEGER,
					value: IntegerWorkflowStepOptionValueDto,
				},
				{
					name: WorkflowStepOptionType.DECIMAL,
					value: DecimalWorkflowStepOptionValueDto,
				},
			],
		},
	})
	options: WorkflowStepOptionValueDto[];
}
