import { IS_AUTH_OPTIONAL_KEY, OptionalAuth } from "./optional-auth.decorator";

describe("OptionalAuth", () => {
	it("marks a controller method as auth-optional", () => {
		class Dummy {
			@OptionalAuth()
			method() {}
		}

		expect(
			Reflect.getMetadata(IS_AUTH_OPTIONAL_KEY, Dummy.prototype["method"]),
		).toBe(true);
	});

	it("marks a whole controller class as auth-optional", () => {
		@OptionalAuth()
		class Dummy {}

		expect(Reflect.getMetadata(IS_AUTH_OPTIONAL_KEY, Dummy)).toBe(true);
	});
});
