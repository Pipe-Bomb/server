import { AttributeFormatter, AttributeType } from "@sdk";

export interface ResolvedAttributeDefinition {
	type: AttributeType;
	supportsMultiple: boolean;
	pluginId: string;
	sourceId: string;
	formatter: AttributeFormatter | null;
}
