// export enum AttributeType {
// 	STRING = "string",
// 	INTEGER = "integer",
// 	DECIMAL = "decimal",
// 	BOOLEAN = "boolean",
// }

export type AttributeType =
	| "string"
	| "integer"
	| "decimal"
	| "boolean"
	| "buffer";

export interface Attribute {
	key: string;
	type: AttributeType;
	supportsMultiple: boolean;
}

export interface BufferAttributeValue {
	extension: string;
	buffer: Buffer | (() => Promise<Buffer>);
}

export interface AttributeValue {
	key: string;
	value: string | number | boolean | BufferAttributeValue;
}
