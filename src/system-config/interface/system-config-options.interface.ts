export type SystemConfigOptions = {
	string: {
		supportsMultiple: boolean;
		minLength?: number;
		maxLength?: number;
		transform?: (value: string) => string;
	};
	boolean: {
		supportsMultiple: boolean;
		transform?: (value: boolean) => boolean;
	};
	integer: {
		supportsMultiple: boolean;
		min?: number;
		max?: number;
		transform?: (value: number) => number;
	};
	decimal: {
		supportsMultiple: boolean;
		min?: number;
		max?: number;
		transform?: (value: number) => number;
	};
};
