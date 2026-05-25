export type AttributeValues = {
	string: string;
	integer: number;
	decimal: number;
	boolean: boolean;
	buffer: BufferAttributeValue;
};

export type AttributeType = keyof AttributeValues;

type AttributeFormatter<T extends AttributeType = AttributeType> = (
	value: AttributeValues[T],
) => string;

export type Attribute<T extends AttributeType = AttributeType> = {
	[K in T]: {
		key: string;
		type: K;
		supportsMultiple: boolean;
	} & (K extends "buffer" ? {} : { formatter?: AttributeFormatter<K> });
}[T];

export interface BufferAttributeValue {
	extension: string;
	buffer: Buffer | (() => Promise<Buffer>);
}

export interface AttributeValue<T extends AttributeType = AttributeType> {
	key: string;
	value: AttributeValues[T];
}
