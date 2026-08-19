import { SystemConfigOptions } from "./system-config-options.interface";
import { SystemConfigType } from "./system-config-type.interface";

export interface RegisteredSystemConfigOption<
	T extends keyof SystemConfigType = keyof SystemConfigType,
> {
	type: T;
	options: SystemConfigOptions[T];
	defaultValues: SystemConfigType[T][];
}

export type AnyRegisteredSystemConfigOption = {
	[K in keyof SystemConfigType]: RegisteredSystemConfigOption<K>;
}[keyof SystemConfigType];
