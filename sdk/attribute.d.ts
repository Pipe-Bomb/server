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
	| "buffer"; // todo: change to enum when properly packaged for plugins

export interface Attribute {
	key: string;
	type: AttributeType;
	supportsMultiple: boolean;
}

export interface BufferAttribute {
	extension: string;
	data: Buffer;
}

export interface AttributeValue {
	key: string;
	value: string | number | boolean | BufferAttribute;
}
