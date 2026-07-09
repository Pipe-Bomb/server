import { Logger } from "./logger";

type WorkflowOptionValues = {
	string: string;
	boolean: boolean;
	enum: string;
	integer: number;
	decimal: number;
};

interface BaseWorkflowOptionDefinition<T extends keyof WorkflowOptionValues> {
	id: string;
	type: T;
}

export interface StringWorkflowOptionDefinition extends BaseWorkflowOptionDefinition<"string"> {}

export interface BooleanWorkflowOptionDefinition extends BaseWorkflowOptionDefinition<"boolean"> {}

export interface IntegerWorkflowOptionDefinition extends BaseWorkflowOptionDefinition<"integer"> {}

export interface DecimalWorkflowOptionDefinition extends BaseWorkflowOptionDefinition<"decimal"> {}

export type EnumWorkflowOptionItem<T extends string> = { id: T } & (
	| { languageKey: string }
	| { name: string }
);

export interface EnumWorkflowOptionDefinition<
	T extends string = string,
> extends BaseWorkflowOptionDefinition<"enum"> {
	enum: EnumWorkflowOptionItem<T>[];
}

export type WorkflowOptionDefinition =
	| StringWorkflowOptionDefinition
	| BooleanWorkflowOptionDefinition
	| IntegerWorkflowOptionDefinition
	| DecimalWorkflowOptionDefinition
	| EnumWorkflowOptionDefinition;

type WorkflowStepContextValueMap<T> = {
	string: [string, []];
	integer: [number, []];
	decimal: [number, []];
	boolean: [boolean, []];
	enum: [T, [readonly T[]]];
};

export interface BaseWorkflowStepContext {
	getWorkflowUuid(): string;
	getOption<
		E extends string | number,
		T extends keyof WorkflowStepContextValueMap<E>,
	>(
		id: string,
		type: T,
		...args: WorkflowStepContextValueMap<E>[T][1]
	): WorkflowStepContextValueMap<E>[T][0] | null;
	getLogger(): Logger;
}

export interface WorkflowTriggerContext extends BaseWorkflowStepContext {
	activate(): void;
	getCreateReason(): "startup" | "trigger-add" | "options-update";
}

export interface WorkflowStepContext extends BaseWorkflowStepContext {
	updateProgress(percentComplete: number): void;
}

export interface WorkflowTrigger {
	id: string;
	type: "trigger";

	getOptions(): WorkflowOptionDefinition[];

	create(workflowTriggerContext: WorkflowTriggerContext): () => void;
}

export interface WorkflowStep {
	id: string;
	type: "step";

	getOptions(): WorkflowOptionDefinition[];
	run(workflowStepContext: WorkflowStepContext): Promise<void>;
}

export interface WorkflowClient {
	registerStep(trigger: WorkflowTrigger | WorkflowStep): Promise<void>;
}
