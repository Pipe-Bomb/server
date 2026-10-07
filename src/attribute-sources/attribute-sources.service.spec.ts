import { AttributeSourcesService } from "./attribute-sources.service";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { DBResource } from "src/resources/entities/resource.entity";

function makeSource(name: string, id: string): LoadedAttributeSource {
	return {
		plugin: { package: { name } },
		source: { id, getName: () => id },
	} as unknown as LoadedAttributeSource;
}

function seedSources(
	service: AttributeSourcesService,
	sources: LoadedAttributeSource[],
) {
	(service as unknown as { sources: LoadedAttributeSource[] }).sources.push(
		...sources,
	);
}

function makeRow(
	pluginId: string,
	sourceId: string,
	key: string,
	ordinal: number,
	value: Partial<DBTrackAttribute>,
): DBTrackAttribute {
	const row = new DBTrackAttribute();
	row.entityId = "entity";
	row.entityRelationId = "entity";
	row.pluginId = pluginId;
	row.sourceId = sourceId;
	row.key = key;
	row.ordinal = ordinal;
	Object.assign(row, value);
	return row;
}

describe("AttributeSourcesService.toMap", () => {
	let service: AttributeSourcesService;

	beforeEach(() => {
		service = new AttributeSourcesService(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
		);
	});

	it("returns null for a null attribute list", () => {
		expect(service.toMap(null, "track")).toBeNull();
	});

	it("returns an empty map when the entity type cannot be determined", () => {
		const rows = [makeRow("a", "src-a", "title", 0, { value_string: "hello" })];
		expect(service.toMap(rows, null)).toEqual({});
	});

	it("drops values whose type does not match the canonical definition", () => {
		const a = makeSource("a", "src-a");
		seedSources(service, [a]);
		service.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});

		const rows = [makeRow("a", "src-a", "title", 0, { value_decimal: 3 })];

		expect(service.toMap(rows, "track")).toEqual({});
	});

	it("drops keys that no registered source defines", () => {
		const a = makeSource("a", "src-a");
		seedSources(service, [a]);

		const rows = [makeRow("a", "src-a", "ghost", 0, { value_string: "x" })];

		expect(service.toMap(rows, "track")).toEqual({});
	});

	it("uses the highest priority defining source's formatter for values from other sources", () => {
		const a = makeSource("a", "src-a");
		const b = makeSource("b", "src-b");
		seedSources(service, [a, b]);

		service.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: true,
			formatter: (value) => value.toUpperCase(),
		});
		service.registerTrackAttribute(b, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});

		const rows = [makeRow("b", "src-b", "title", 0, { value_string: "hello" })];
		const map = service.toMap(rows, "track");

		expect(map.title.type).toBe("string");
		expect(map.title.values).toEqual(["hello"]);
		expect(map.title.formatted).toEqual(["HELLO"]);
		expect(map.title.pluginId).toBe("a");
		expect(map.title.sourceId).toBe("src-a");
	});

	it("keeps only the first row when the canonical definition does not support multiple", () => {
		const a = makeSource("a", "src-a");
		seedSources(service, [a]);
		service.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: false,
		});

		const rows = [
			makeRow("a", "src-a", "title", 1, { value_string: "second" }),
			makeRow("a", "src-a", "title", 0, { value_string: "first" }),
		];

		const map = service.toMap(rows, "track");

		expect(map.title.values).toEqual(["first"]);
	});

	it("merges all matching rows ordered by source then ordinal when multiple are supported", () => {
		const a = makeSource("a", "src-a");
		const b = makeSource("b", "src-b");
		seedSources(service, [a, b]);

		service.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});
		service.registerTrackAttribute(b, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});

		const rows = [
			makeRow("b", "src-b", "title", 0, { value_string: "b0" }),
			makeRow("a", "src-a", "title", 1, { value_string: "a1" }),
			makeRow("a", "src-a", "title", 0, { value_string: "a0" }),
		];

		const map = service.toMap(rows, "track");

		expect(map.title.values).toEqual(["a0", "a1", "b0"]);
	});

	it("orders custom rows before sourced rows", () => {
		const a = makeSource("a", "src-a");
		seedSources(service, [a]);
		service.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});

		const rows = [
			makeRow("a", "src-a", "title", 0, { value_string: "source" }),
			makeRow("", "", "title", 0, { value_string: "custom" }),
		];

		const map = service.toMap(rows, "track");

		expect(map.title.values).toEqual(["custom", "source"]);
	});

	it("sets formatted to null for buffer attributes", () => {
		const a = makeSource("a", "src-a");
		seedSources(service, [a]);
		service.registerTrackAttribute(a, {
			key: "art",
			type: "buffer",
			supportsMultiple: false,
		});

		const rows = [
			makeRow("a", "src-a", "art", 0, {
				value_buffer: {
					toResponse: () => ({ uuid: "u" }),
				} as unknown as DBResource,
			}),
		];

		const map = service.toMap(rows, "track");

		expect(map.art.formatted).toBeNull();
		expect(map.art.values).toEqual([{ uuid: "u" }]);
	});
});
