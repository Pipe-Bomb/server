import { SystemConfigType } from "./system-config-type.interface";

export type SystemConfigValue<
	T extends keyof SystemConfigType = keyof SystemConfigType,
> = {
	key: string;
	type: T;
} & (
	| {
			supportsMultiple: true;
			value: SystemConfigType[T][];
	  }
	| {
			supportsMultiple: false;
			value: [SystemConfigType[T]];
	  }
);
