import { WorkflowOptionDefinition, WorkflowTrigger } from "@sdk";
import {
	orderWorkflowSteps,
	workflowStepOptionToResponse,
	workflowStepToResponse,
} from "./workflows.util";
import { DBWorkflowStep } from "./entity/workflow-step.entity";
import { DBWorkflowStepOptionValue } from "./entity/workflow-step-option-value.entity";
import { OptionalLoaded } from "src/types/loaded";
import { WorkflowStepOptionType } from "./enum/workflow-step-option-type.enum";
import { WorkflowStepType } from "./enum/workflow-step-type.enum";

function makeStep(
	uuid: string,
	previousStepUuid: string | null,
): DBWorkflowStep {
	const step = new DBWorkflowStep();
	step.uuid = uuid;
	step.previousStepUuid = previousStepUuid;
	return step;
}

const trigger: WorkflowTrigger = {
	id: "trigger-1",
	type: "trigger",
	getOptions: () => [],
	create: () => () => {},
};

function makeValue(): DBWorkflowStepOptionValue {
	const value = new DBWorkflowStepOptionValue();
	value.optionId = "option-1";
	value.stepUuid = "step-1";
	return value;
}

describe("orderWorkflowSteps", () => {
	it("returns the chain starting at the root step", () => {
		const root = makeStep("uuid-a", null);
		const child = makeStep("uuid-b", "uuid-a");

		expect(orderWorkflowSteps([child, root])).toEqual([root, child]);
	});

	it("returns an empty list when no root step exists", () => {
		const a = makeStep("uuid-a", "uuid-missing");
		const b = makeStep("uuid-b", "uuid-a");

		expect(orderWorkflowSteps([a, b])).toEqual([]);
	});

	it("skips steps that are not reachable from the root", () => {
		const root = makeStep("uuid-a", null);
		const child = makeStep("uuid-b", "uuid-a");
		const orphan = makeStep("uuid-c", "uuid-missing");

		expect(orderWorkflowSteps([root, child, orphan])).toEqual([root, child]);
	});
});

describe("workflowStepToResponse", () => {
	it("maps a loaded step to its definition response", () => {
		const loaded = {
			plugin: { package: { name: "plugin-a" } },
			object: trigger,
		} as unknown as OptionalLoaded<WorkflowTrigger>;

		expect(workflowStepToResponse(loaded)).toEqual({
			pluginId: "plugin-a",
			stepId: "trigger-1",
			stepType: WorkflowStepType.TRIGGER,
		});
	});

	it("uses a null pluginId when the plugin is not loaded", () => {
		const loaded = {
			plugin: null,
			object: trigger,
		} as unknown as OptionalLoaded<WorkflowTrigger>;

		expect(workflowStepToResponse(loaded)).toEqual({
			pluginId: null,
			stepId: "trigger-1",
			stepType: WorkflowStepType.TRIGGER,
		});
	});
});

describe("workflowStepOptionToResponse", () => {
	it("maps a string option with a value", () => {
		const definition: WorkflowOptionDefinition = { id: "opt", type: "string" };
		const value = makeValue();
		value.value_string = "hello";

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.STRING,
			value: "hello",
		});
	});

	it("maps a string option without a value to null", () => {
		const definition: WorkflowOptionDefinition = { id: "opt", type: "string" };

		expect(workflowStepOptionToResponse(definition, null)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.STRING,
			value: null,
		});
	});

	it("maps a boolean option with a value", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "boolean",
		};
		const value = makeValue();
		value.value_boolean = true;

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.BOOLEAN,
			value: true,
		});
	});

	it("maps an integer option with a value", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "integer",
		};
		const value = makeValue();
		value.value_int = 42;

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.INTEGER,
			value: 42,
		});
	});

	it("maps a boolean option without a value to null", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "boolean",
		};

		expect(workflowStepOptionToResponse(definition, null)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.BOOLEAN,
			value: null,
		});
	});

	it("maps an integer option without a value to null", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "integer",
		};

		expect(workflowStepOptionToResponse(definition, null)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.INTEGER,
			value: null,
		});
	});

	it("maps a decimal option with a value", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "decimal",
		};
		const value = makeValue();
		value.value_decimal = 1.5;

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.DECIMAL,
			value: 1.5,
		});
	});

	it("maps a decimal option without a value to null", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "decimal",
		};

		expect(workflowStepOptionToResponse(definition, null)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.DECIMAL,
			value: null,
		});
	});

	it("maps an enum option with a matching value and its option items", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "enum",
			enum: [
				{ id: "a", name: "A" },
				{ id: "b", languageKey: "b.key" },
			],
		};
		const value = makeValue();
		value.value_string = "b";

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.ENUM,
			value: "b",
			options: [
				{ id: "a", name: "A", languageKey: null },
				{ id: "b", name: null, languageKey: "b.key" },
			],
		});
	});

	it("maps an enum option with a value not in the list to null", () => {
		const definition: WorkflowOptionDefinition = {
			id: "opt",
			type: "enum",
			enum: [{ id: "a", name: "A" }],
		};
		const value = makeValue();
		value.value_string = "z";

		expect(workflowStepOptionToResponse(definition, value)).toEqual({
			id: "opt",
			type: WorkflowStepOptionType.ENUM,
			value: null,
			options: [{ id: "a", name: "A", languageKey: null }],
		});
	});

	it("throws for an unknown option type", () => {
		const definition = {
			id: "opt",
			type: "float",
		} as unknown as WorkflowOptionDefinition;

		expect(() => workflowStepOptionToResponse(definition, null)).toThrow(
			"Unknown option definition",
		);
	});
});
