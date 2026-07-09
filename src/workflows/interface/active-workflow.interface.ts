export interface ActiveWorkflow {
	uuid: string;
	currentStepIndex: number;
	currentStepUuid: string;
	totalSteps: number;
	stepPercent: number | null;
	hasPendingRerun: boolean;
}
