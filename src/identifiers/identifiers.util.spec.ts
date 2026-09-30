import { Identifier, IdentifierDependency } from "@sdk";
import { orderIdentifiers } from "./identifiers.util";
import { LoadedIdentifier } from "./interface/loaded-identifier";
import { ExistingDependency } from "./interface/existing-identifier-dependency.interface";

function makeItem(
	pluginName: string,
	id: string,
	deps: IdentifierDependency[] = [],
	softDeps: IdentifierDependency[] = [],
): LoadedIdentifier<Identifier> {
	const identifier: Identifier = {
		id,
		getDependencies: () => deps,
		getSoftDependencies: () => softDeps,
	};
	return {
		plugin: { package: { name: pluginName } },
		identifier,
	} as unknown as LoadedIdentifier<Identifier>;
}

describe("orderIdentifiers", () => {
	it("returns all inputs unchanged when nothing depends on anything", () => {
		const a = makeItem("p1", "a");
		const b = makeItem("p1", "b");

		expect(orderIdentifiers([a, b])).toEqual([a, b]);
	});

	it("orders a dependent after its hard dependency", () => {
		const base = makeItem("p1", "base");
		const dependent = makeItem("p1", "dependent", [
			{ pluginId: "p1", sourceId: "base" },
		]);

		expect(orderIdentifiers([dependent, base])).toEqual([base, dependent]);
	});

	it("orders a dependent after its soft dependency", () => {
		const base = makeItem("p1", "base");
		const dependent = makeItem(
			"p1",
			"dependent",
			[],
			[{ pluginId: "p1", sourceId: "base" }],
		);

		expect(orderIdentifiers([dependent, base])).toEqual([base, dependent]);
	});

	it("prunes items whose dependency cannot be resolved", () => {
		const keep = makeItem("p1", "keep");
		const pruned = makeItem("p1", "pruned", [
			{ pluginId: "other", sourceId: "missing" },
		]);

		expect(orderIdentifiers([pruned, keep])).toEqual([keep]);
	});

	it("satisfies dependencies from the withDependencies external set", () => {
		const dependent = makeItem("p1", "dependent", [
			{ pluginId: "ext", sourceId: "x" },
		]);
		const external: ExistingDependency[] = [{ pluginId: "ext", sourceId: "x" }];

		expect(orderIdentifiers([dependent], external)).toEqual([dependent]);
	});

	it("resolves dependencies with a null pluginId by sourceId suffix", () => {
		const target = makeItem("p2", "disc-id");
		const dependent = makeItem("p1", "dependent", [
			{ pluginId: null, sourceId: "disc-id" },
		]);

		expect(orderIdentifiers([dependent, target])).toEqual([target, dependent]);
	});

	it("prunes items whose null-pluginId dependency matches nothing", () => {
		const pruned = makeItem("p1", "pruned", [
			{ pluginId: null, sourceId: "nope" },
		]);
		const keep = makeItem("p1", "keep");

		expect(orderIdentifiers([pruned, keep])).toEqual([keep]);
	});

	it("resolves a null-pluginId dependency against the external set by suffix", () => {
		const dependent = makeItem("p1", "dependent", [
			{ pluginId: null, sourceId: "ext-x" },
		]);
		const external: ExistingDependency[] = [
			{ pluginId: "ext", sourceId: "ext-x" },
		];

		expect(orderIdentifiers([dependent], external)).toEqual([dependent]);
	});

	it("resolves soft-dependency cycles by falling back to hard-ready items", () => {
		const a = makeItem("p1", "a", [], [{ pluginId: "p1", sourceId: "b" }]);
		const b = makeItem("p1", "b", [], [{ pluginId: "p1", sourceId: "a" }]);

		expect(orderIdentifiers([a, b])).toEqual([a, b]);
	});

	it("drops circular hard dependencies but keeps independent items", () => {
		const a = makeItem("p1", "a", [{ pluginId: "p1", sourceId: "b" }]);
		const b = makeItem("p1", "b", [{ pluginId: "p1", sourceId: "a" }]);
		const independent = makeItem("p1", "independent");

		expect(orderIdentifiers([a, b, independent])).toEqual([independent]);
	});
});
