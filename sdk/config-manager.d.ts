export type ValueMap = {
	string: string;
	integer: number;
	decimal: number;
	boolean: boolean;
};

export interface ConfigManagerApiContext {
	getValue<T extends keyof ValueMap>(
		key: string,
		type: T,
		multiple?: false,
	): Promise<ValueMap[T] | null>;
	getValue<T extends keyof ValueMap>(
		key: string,
		type: T,
		multiple: true,
	): Promise<ValueMap[T][]> | null;

	setValue<T extends keyof ValueMap>(
		key: string,
		type: T,
		value: ValueMap[T] | ValueMap[T][],
	): Promise<void>;

	delete(key: string): Promise<void>;
}

export interface ValueWithUuid<T extends keyof ValueMap> {
	value: T[];
	userUuid: string;
}

export interface UserConfigManagerApiContext {
	getValue<T extends keyof ValueMap>(
		userUuid: string,
		key: string,
		type: T,
		multiple?: false,
	): Promise<ValueMap[T] | null>;
	getValue<T extends keyof ValueMap>(
		userUuid: string,
		key: string,
		type: T,
		multiple: true,
	): Promise<ValueMap[T][]> | null;

	getAllValues<T extends keyof ValueMap>(
		key: string,
		type: T,
	): Promise<ValueWithUuid<T>[]>;

	setValue<T extends keyof ValueMap>(
		userUuid: string,
		key: string,
		type: T,
		value: ValueMap[T] | ValueMap[T][],
	): Promise<void>;

	delete(userUuid: string, key: string): Promise<void>;
}

export interface ConfigManager {
	getConfigOptions(): Promise<ConfigNode>;
	update(values: Record<string, any>): Promise<ConfigNode>;
	enable(
		configManagerApiContext: ConfigManagerApiContext,
	): void | Promise<void>;
}

export interface UserConfigManager {
	canUserAccess(userUuid: string): boolean;

	getConfigOptions(userUuid: string): Promise<ConfigNode | null>;
	update(
		userUuid: string,
		values: Record<string, any>,
	): Promise<ConfigNode | null>;
	enable(
		userConfigManagerApiContext: UserConfigManagerApiContext,
	): void | Promise<void>;
}

export interface ConfigSection {}

export type ConfigNodeType = "text" | "heading" | "section";

interface BaseConfigNode {
	type: ConfigNodeType;
}

export interface TextConfigNode extends BaseConfigNode {
	type: "text";
	id: string;
	name: string;
	value: string;
	placeholder?: string | null;
}

export interface HeadingConfigNode extends BaseConfigNode {
	type: "heading";
	size: "sm" | "md" | "lg";
	content: string;
}

export interface SectionConfigNode extends BaseConfigNode {
	type: "section";
	children: ConfigNode[];
}

// export interface CollapsibleSectionConfigNode extends SectionConfigNode {
// 	collapsed: boolean;
// }

export type ConfigNode = TextConfigNode | HeadingConfigNode | SectionConfigNode;
