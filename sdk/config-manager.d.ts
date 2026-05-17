type ValueMap = {
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

export interface ConfigManager {
	getConfigOptions(): Promise<ConfigNode>;
	update(values: Record<string, any>): Promise<ConfigNode>;
	enable(
		configManagerApiContext: ConfigManagerApiContext,
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
