import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { DBWorkflow } from "./workflow.entity";
import { WorkflowStepResponse } from "../response/workflow-step.response";
import { WorkflowStepType } from "../enum/workflow-step-type.enum";
import { DBWorkflowStepOptionValue } from "./workflow-step-option-value.entity";
import { WorkflowOptionDefinition, WorkflowStep, WorkflowTrigger } from "@sdk";
import { WorkflowStepOptionValueResponse } from "../response/workflow-step-option-value.response";
import { workflowStepOptionToResponse } from "../workflows.util";

@Entity("workflow_steps")
export class DBWorkflowStep {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "uuid",
	})
	workflowUuid: string;

	@ManyToOne(() => DBWorkflow, (workflow) => workflow.steps, {
		onDelete: "CASCADE",
	})
	@JoinColumn({
		name: "workflowUuid",
	})
	workflow?: DBWorkflow;

	@Column({
		enum: WorkflowStepType,
	})
	stepType: WorkflowStepType;

	@Column({
		type: "uuid",
		nullable: true,
	})
	previousStepUuid: string | null;

	@OneToOne(() => DBWorkflowStep, (step) => step.nextStep)
	@JoinColumn({
		name: "previousStepUuid",
	})
	previousStep?: DBWorkflowStep | null;

	@OneToOne(() => DBWorkflowStep, (step) => step.previousStep)
	nextStep?: DBWorkflowStep | null;

	@Column({
		type: "text",
		nullable: true,
	})
	pluginId: string | null;

	@Column({
		type: "text",
		nullable: true,
	})
	stepId: string;

	@OneToMany(() => DBWorkflowStepOptionValue, (optionValue) => optionValue.step)
	optionValues?: DBWorkflowStepOptionValue[] | null;

	toResponse(
		stepSchema: WorkflowStep | WorkflowTrigger | null,
	): WorkflowStepResponse {
		const optionResponses: WorkflowStepOptionValueResponse[] = [];
		if (this.optionValues && stepSchema) {
			const optionDefinitions = stepSchema.getOptions();
			for (const optionDefinition of optionDefinitions) {
				const value = this.optionValues.find(
					(value) => value.optionId == optionDefinition.id,
				);
				optionResponses.push(
					workflowStepOptionToResponse(optionDefinition, value ?? null),
				);
			}
		}

		return {
			uuid: this.uuid,
			workflowUuid: this.workflowUuid,
			stepType: this.stepType,
			pluginId: this.pluginId,
			stepId: this.stepId,
			loaded: !!stepSchema,
			options: this.optionValues ? optionResponses : null,
		};
	}
}
