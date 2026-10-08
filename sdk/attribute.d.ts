import type { Readable } from "stream";

export type AttributeValues = {
	string: string;
	integer: number;
	decimal: number;
	boolean: boolean;
	buffer: BufferAttributeValue;
};

export type AttributeType = keyof AttributeValues;

export type AttributeFormatter<T extends AttributeType = AttributeType> = (
	value: AttributeValues[T],
) => string;

export interface BufferAttributeFormatterInfo {
	getStream: () => Readable;
	uuid: string;
	extension: string;
	params: Record<string, string>;
}

export interface BufferAttributeFormatterResult {
	stream: Readable;
	contentType?: string;
	extension?: string;
}

export type BufferAttributeFormatter = (
	info: BufferAttributeFormatterInfo,
) => Promise<BufferAttributeFormatterResult | null>;

export type Attribute<T extends AttributeType = AttributeType> = {
	[K in T]: {
		key: string;
		type: K;
		supportsMultiple: boolean;
	} & (K extends "buffer"
		? {
				formatter?: BufferAttributeFormatter;
			}
		: { formatter?: AttributeFormatter<K> });
}[T];

export interface BufferAttributeValue {
	extension: string;
	buffer: Buffer | (() => Promise<Buffer>);
}

export interface AttributeValue<T extends AttributeType = AttributeType> {
	key: string;
	value: AttributeValues[T];
}
