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
import { ActiveWorkflow } from "../interface/active-workflow.interface";

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
		active: ActiveWorkflow | null,
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
			currentActiveStepIndex: active?.currentStepIndex ?? null,
			currentActiveStepUuid: active?.currentStepUuid ?? null,
			totalActiveSteps: active?.totalSteps ?? null,
			currentActiveStepPercent:
				typeof active?.stepPercent == "number"
					? active.stepPercent * 100
					: null,
			steps,
		};
	}
}
