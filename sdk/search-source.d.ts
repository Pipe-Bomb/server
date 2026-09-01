import { AttributeType } from "./attribute";

export interface SearchSourceApiContext {}

export interface SortMethod {
	key: string;
	label?: string;
	ascending: boolean;
	descending: boolean;
}

export type FilterableAttribute<T extends AttributeType = AttributeType> = {
	[K in T]: {
		entityType: "track" | "artist" | "album";
		attributeKey: string;
		attributeType: K;
		label?: string;
	} & (K extends "string" ? { supportsFuzzy: boolean } : {});
}[T];

export interface SearchSourceCapabilities {
	sortMethods?: SortMethod[];
	filterableAttributes?: FilterableAttribute[];
}

export interface SearchEntityQuery {
	limit: number;
	page?: number;
	allowedUuids?: string[];
}

export interface SearchSort {
	key: string;
	direction: "asc" | "desc";
}

export type SearchFilter =
	| StringSearchFilter
	| IntegerSearchFilter
	| DecimalSearchFilter
	| BooleanSearchFilter
	| BufferSearchFilter;

export interface StringSearchFilter {
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: "string";
	value?: string;
	partial?: boolean;
	fuzzy?: boolean;
	exists?: boolean;
	inverse?: boolean;
}

export interface IntegerSearchFilter {
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: "integer";
	value?: number;
	min?: number;
	max?: number;
	exists?: boolean;
	inverse?: boolean;
}

export interface DecimalSearchFilter {
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: "decimal";
	value?: number;
	min?: number;
	max?: number;
	exists?: boolean;
	inverse?: boolean;
}

export interface BooleanSearchFilter {
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: "boolean";
	value?: boolean;
	exists?: boolean;
	inverse?: boolean;
}

export interface BufferSearchFilter {
	entityType: "track" | "artist" | "album";
	attributeKey: string;
	attributeType: "buffer";
	exists?: boolean;
	inverse?: boolean;
}

export interface SearchQuery {
	query?: string;
	entities: {
		tracks?: SearchEntityQuery;
		artists?: SearchEntityQuery;
		albums?: SearchEntityQuery;
	};
	sort?: SearchSort;
	filters?: SearchFilter[];
}

export interface SearchSourceResults {
	tracks?: string[];
	trackTotal?: number;
	artists?: string[];
	artistTotal?: number;
	albums?: string[];
	albumTotal?: number;
}

export interface SearchSourceInfo {
	pluginId: string;
	sourceId: string;
	source: SearchSource;
}

export interface SearchSource {
	readonly id: string;
	enable(context: SearchSourceApiContext): void | Promise<void>;
	getName(): string;
	getCapabilities(entities: {
		tracks?: boolean;
		albums?: boolean;
		artists?: boolean;
	}): SearchSourceCapabilities;
	search(query: SearchQuery): Promise<SearchSourceResults>;
}
