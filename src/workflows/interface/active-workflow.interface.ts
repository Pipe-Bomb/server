export interface ActiveWorkflow {
	uuid: string;
	currentStepIndex: number;
	currentStepUuid: string;
	totalSteps: number;
	stepPercent: number | null;
	hasPendingRerun: boolean;
	endCallbacks: Set<(reason: "complete" | "error") => void>;
	progressCallbacks: Set<(percent: number) => void>;
}
