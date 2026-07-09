import { WorkflowOptionDefinition, WorkflowStep, WorkflowTrigger } from "@sdk";
import { DBWorkflowStep } from "./entity/workflow-step.entity";
import { OptionalLoaded } from "src/types/loaded";
import { WorkflowStepDefinitionResponse } from "./response/step-declaration.response";
import { WorkflowStepType } from "./enum/workflow-step-type.enum";
import {
	BooleanWorkflowStepOptionValueResponse,
	EnumWorkflowStepOptionValueResponse,
	IntegerWorkflowStepOptionValueResponse,
	StringWorkflowStepOptionValueResponse,
	WorkflowStepOptionValueResponse,
} from "./response/workflow-step-option-value.response";
import { WorkflowStepOptionType } from "./enum/workflow-step-option-type.enum";
import { DBWorkflowStepOptionValue } from "./entity/workflow-step-option-value.entity";

export function orderWorkflowSteps(steps: DBWorkflowStep[]) {
	const stepMap = new Map<string | null, DBWorkflowStep>();
	let currentStep: DBWorkflowStep | undefined;

	for (const step of steps) {
		if (!step.previousStepUuid) {
			currentStep = step;
		} else {
			stepMap.set(step.previousStepUuid, step);
		}
	}

	const orderedSteps: DBWorkflowStep[] = [];
	while (currentStep) {
		orderedSteps.push(currentStep);
		currentStep = stepMap.get(currentStep.uuid);
	}

	return orderedSteps;
}

export function workflowStepToResponse(
	step: OptionalLoaded<WorkflowTrigger | WorkflowStep>,
	// optionValues: DBWorkflowStepOptionValue[] | null,
): WorkflowStepDefinitionResponse {
	// const options = step.object.getOptions();
	// const optionResponses: WorkflowStepOptionValueResponse[] = options.map(
	// 	(option) => {
	// 		const value = optionValues?.find((value) => value.optionId == option.id);
	// 		return workflowStepOptionToResponse(option, value ?? null);
	// 	},
	// );

	return {
		pluginId: step.plugin?.package.name ?? null,
		stepId: step.object.id,
		stepType: WorkflowStepType.TRIGGER,
		// options: optionResponses,
	};
}

export function workflowStepOptionToResponse(
	definition: WorkflowOptionDefinition,
	value: DBWorkflowStepOptionValue | null,
): WorkflowStepOptionValueResponse {
	if (definition.type == "string") {
		const response: StringWorkflowStepOptionValueResponse = {
			id: definition.id,
			type: WorkflowStepOptionType.STRING,
			value: value?.value_string ?? null,
		};
		return response;
	}

	if (definition.type == "boolean") {
		const response: BooleanWorkflowStepOptionValueResponse = {
			id: definition.id,
			type: WorkflowStepOptionType.BOOLEAN,
			value: value?.value_boolean ?? null,
		};
		return response;
	}

	if (definition.type == "integer") {
		const response: IntegerWorkflowStepOptionValueResponse = {
			id: definition.id,
			type: WorkflowStepOptionType.INTEGER,
			value: value?.value_int ?? null,
		};
		return response;
	}

	if (definition.type == "decimal") {
		const response: IntegerWorkflowStepOptionValueResponse = {
			id: definition.id,
			type: WorkflowStepOptionType.DECIMAL,
			value: value?.value_decimal ?? null,
		};
		return response;
	}

	if (definition.type == "enum") {
		const response: EnumWorkflowStepOptionValueResponse = {
			id: definition.id,
			type: WorkflowStepOptionType.ENUM,
			value:
				value?.value_string &&
				definition.enum.some((item) => item.id == value.value_string)
					? value.value_string
					: null,
			options: definition.enum.map((item) => ({
				id: item.id,
				name: "name" in item ? item.name : null,
				languageKey: "languageKey" in item ? item.languageKey : null,
			})),
		};
		return response;
	}

	throw new Error(`Unknown option definition`);
}
