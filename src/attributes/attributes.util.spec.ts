import { toSimplifiedAttributeList } from "./attributes.util";
import { DBTrackAttribute } from "./entities/track-attribute.entity";
import { AttributeType } from "./enum/attribute-type.enum";

function makeTrackAttribute(
	key: string,
	ordinal: number,
	value: string,
): DBTrackAttribute {
	const attribute = new DBTrackAttribute();
	attribute.entityId = "track-1";
	attribute.entityRelationId = "track-1";
	attribute.pluginId = "plugin-a";
	attribute.sourceId = `source-${ordinal}`;
	attribute.key = key;
	attribute.ordinal = ordinal;
	attribute.value_string = value;
	return attribute;
}

describe("toSimplifiedAttributeList", () => {
	it("maps a single attribute per key to its response", () => {
		const attributes = [
			makeTrackAttribute("title", 1, "Song"),
			makeTrackAttribute("genre", 1, "Pop"),
		];

		const result = toSimplifiedAttributeList(attributes);

		expect(Object.keys(result).sort()).toEqual(["genre", "title"]);
		expect(result["title"].type).toBe(AttributeType.STRING);
		expect(result["title"].values).toEqual(["Song"]);
		expect(result["title"].pluginId).toBe("plugin-a");
		expect(result["title"].sourceId).toBe("source-1");
		expect(result["genre"].values).toEqual(["Pop"]);
	});

	it("merges multiple same-type attributes of one key into the first response", () => {
		const attributes = [
			makeTrackAttribute("alias", 1, "A1"),
			makeTrackAttribute("alias", 2, "A2"),
			makeTrackAttribute("alias", 3, "A3"),
		];

		const result = toSimplifiedAttributeList(attributes);

		expect(Object.keys(result)).toEqual(["alias"]);
		expect(result["alias"].values).toEqual(["A1", "A2", "A3"]);
		expect(result["alias"].sourceId).toBe("source-1");
	});

	it("throws when the same key has attributes of different types", () => {
		const stringAttribute = makeTrackAttribute("rating", 1, "high");
		const integerAttribute = makeTrackAttribute("rating", 2, "unused");
		integerAttribute.value_string = null;
		integerAttribute.value_int = 2;

		expect(() =>
			toSimplifiedAttributeList([stringAttribute, integerAttribute]),
		).toThrow(/multiple values of key/);
	});

	it("returns an empty object when there are no attributes", () => {
		expect(toSimplifiedAttributeList([])).toEqual({});
	});
});
