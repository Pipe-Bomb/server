export interface TaskRunContext {
	update(percentComplete: number);
}

export interface Task {
	id: string;
	// name: string;
	run: (context: TaskRunContext) => Promise<void>;
}
