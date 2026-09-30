import { PRIVILEGES_KEY, Privileges } from "./privileges.decorator";

describe("Privileges", () => {
	it("sets the PRIVILEGES_KEY metadata with the given keys", () => {
		class Dummy {
			@Privileges("tracks.write", "plugins.manage")
			method() {}
		}

		expect(
			Reflect.getMetadata(PRIVILEGES_KEY, Dummy.prototype["method"]),
		).toEqual(["tracks.write", "plugins.manage"]);
	});

	it("supports the wildcard privilege on a class", () => {
		class Dummy {}
		const decorated = Privileges("*")(Dummy);

		expect(decorated).toBe(Dummy);
		expect(Reflect.getMetadata(PRIVILEGES_KEY, Dummy)).toEqual(["*"]);
	});
});
