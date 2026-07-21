import { Module } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBResumableTaskProgress } from "./entity/resumable-task-progress.entity";
import { WorkflowsModule } from "src/workflows/workflows.module";
import { UsersModule } from "src/users/users.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBResumableTaskProgress]),
		WorkflowsModule,
		UsersModule,
	],
	controllers: [TasksController],
	providers: [TasksService],
	exports: [TasksService],
})
export class TasksModule {}
