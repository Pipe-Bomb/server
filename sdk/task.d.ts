export interface TaskRunContext {
	update(percentComplete: number): void;
	getRunId(): string;
}

type TaskBase = {
	readonly id: string;
	readonly resumable: boolean;
};

export type SimpleTask = TaskBase & {
	run(context: TaskRunContext): Promise<void>;
};

export type SubTask<T extends string = string> = TaskBase & {
	getSubTasks(): readonly T[];
	run(context: TaskRunContext, subTaskId: T): Promise<void>;
};

export type Task = SimpleTask | SubTask;
