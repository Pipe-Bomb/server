import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { DBWorkflowStep } from "./workflow-step.entity";
import { WorkflowResponse } from "../response/workflow.response";
import { WorkflowStepResponse } from "../response/workflow-step.response";
import { orderWorkflowSteps } from "../workflows.util";
import { OptionalLoaded } from "src/types/loaded";
import { WorkflowStep, WorkflowTrigger } from "@sdk";

@Entity("workflows")
export class DBWorkflow {
	@PrimaryGeneratedColumn("uuid")
	uuid: string;

	@Column({
		type: "text",
	})
	name: string;

	@CreateDateColumn({
		type: "integer",
	})
	dateCreated: number;

	@OneToMany(() => DBWorkflowStep, (step) => step.workflow)
	steps?: DBWorkflowStep[];

	toResponse(
		loadedSteps: OptionalLoaded<WorkflowTrigger | WorkflowStep>[],
	): WorkflowResponse {
		let steps: WorkflowStepResponse[] | null = null;
		if (this.steps) {
			steps = orderWorkflowSteps(this.steps).map((step) => {
				const stepSchema = loadedSteps.find(
					(stepSchema) =>
						(stepSchema.plugin?.package.name ?? null) == step.pluginId &&
						stepSchema.object.id == step.stepId,
				);
				return step.toResponse(stepSchema?.object ?? null);
			});
		}

		return {
			uuid: this.uuid,
			name: this.name,
			dateCreated: new Date(this.dateCreated),
			steps,
		};
	}
}
