import { Attribute } from "@sdk";
import { LoadedAttributeSource } from "./loaded-attribute-source.interface";

export interface LoadedAttribute {
	attribute: Attribute;
	source: LoadedAttributeSource | null;
}
