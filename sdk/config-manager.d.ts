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

	search?(id: string, query: string): Promise<ConfigNode>;

	onButtonPress?(id: string): Promise<ConfigNode>;
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

	search?(id: string, query: string): Promise<ConfigNode | null>;
}

export interface ConfigSection {}

export type ConfigNodeType =
	| "text"
	| "heading"
	| "section"
	| "paragraph"
	| "checkbox"
	| "orderable"
	| "search"
	| "markdown"
	| "button";

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
	background?: "surface" | "warning" | "error" | "none";
	horizontal?: boolean;
}

export interface ParagraphConfigNode extends BaseConfigNode {
	type: "paragraph";
	content: string;
}

export interface CheckboxConfigNode extends BaseConfigNode {
	type: "checkbox";
	id: string;
	checked: boolean;
	readonly?: boolean | null;
}

export type OrderableChild = ConfigNode & {
	orderableId: string;
};

export interface OrderableConfigNode extends BaseConfigNode {
	type: "orderable";
	id: string;
	children: OrderableChild[];
}

export interface SearchConfigNode extends BaseConfigNode {
	type: "search";
	id: string;
	name: string;
	value: string;
	placeholder?: string | null;
	results: ConfigNode | null;
}

export interface MarkdownConfigNode extends BaseConfigNode {
	type: "markdown";
	content: string;
}

export interface ButtonConfigNode extends BaseConfigNode {
	type: "button";
	id: string;
	content: string;
}

export type ConfigNode =
	| TextConfigNode
	| HeadingConfigNode
	| SectionConfigNode
	| ParagraphConfigNode
	| CheckboxConfigNode
	| OrderableConfigNode
	| SearchConfigNode
	| MarkdownConfigNode
	| ButtonConfigNode;
