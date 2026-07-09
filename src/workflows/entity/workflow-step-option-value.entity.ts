import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { DBWorkflowStep } from "./workflow-step.entity";

@Entity("workflow_step_option_values")
export class DBWorkflowStepOptionValue {
	@PrimaryColumn({
		type: "text",
	})
	optionId: string;

	@PrimaryColumn({
		type: "uuid",
	})
	stepUuid: string;

	@ManyToOne(() => DBWorkflowStep, (step) => step.optionValues, {
		onDelete: "CASCADE",
	})
	@JoinColumn({
		name: "stepUuid",
	})
	step?: DBWorkflowStep;

	@Column({
		type: "text",
		nullable: true,
	})
	value_string: string | null;

	@Column({
		type: "integer",
		nullable: true,
	})
	value_int: number | null;

	@Column({
		type: "double precision",
		nullable: true,
	})
	value_decimal: number | null;

	@Column({
		type: "boolean",
		nullable: true,
	})
	value_boolean: boolean | null;
}
