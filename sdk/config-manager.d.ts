export interface ConfigManager {
	getConfigOptions(): ConfigNode;
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
