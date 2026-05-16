export interface TaskRunContext {
	update(percentComplete: number): void;
	getRunId(): string;
}

export interface Task {
	readonly id: string;
	readonly resumable: boolean;
	// name: string;
	run: (context: TaskRunContext) => Promise<void>;
}
