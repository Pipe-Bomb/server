import { Module } from "@nestjs/common";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBWorkflow } from "./entity/workflow.entity";
import { DBWorkflowStep } from "./entity/workflow-step.entity";
import { UsersModule } from "src/users/users.module";
import { WorkflowStepsController } from "./workflow-steps.controller";
import { DBWorkflowStepOptionValue } from "./entity/workflow-step-option-value.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			DBWorkflow,
			DBWorkflowStep,
			DBWorkflowStepOptionValue,
		]),
		UsersModule,
	],
	controllers: [WorkflowsController, WorkflowStepsController],
	providers: [WorkflowsService],
	exports: [WorkflowsService],
})
export class WorkflowsModule {}
