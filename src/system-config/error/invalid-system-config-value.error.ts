export class InvalidSystemConfigValueError extends Error {
	constructor(
		public readonly key: string,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}
