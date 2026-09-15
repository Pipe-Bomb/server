export class DeregistrationBlockedError extends Error {
	constructor(
		public readonly target: string,
		public readonly blockedBy: string[],
	) {
		super(
			`Cannot deregister "${target}": blocked by [${blockedBy.join(", ")}]`,
		);
	}
}
