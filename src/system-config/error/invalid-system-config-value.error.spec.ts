import { InvalidSystemConfigValueError } from "./invalid-system-config-value.error";

describe("InvalidSystemConfigValueError", () => {
	it("exposes the key and passes the message through", () => {
		const error = new InvalidSystemConfigValueError(
			"language",
			"not a valid language",
		);

		expect(error.key).toBe("language");
		expect(error.message).toBe("not a valid language");
		expect(error).toBeInstanceOf(InvalidSystemConfigValueError);
		expect(error).toBeInstanceOf(Error);
	});

	it("propagates the cause from the error options", () => {
		const cause = new Error("root failure");
		const error = new InvalidSystemConfigValueError("language", "bad value", {
			cause,
		});

		expect(error.cause).toBe(cause);
	});

	it("leaves cause undefined when no options are given", () => {
		const error = new InvalidSystemConfigValueError("key", "message");

		expect(error.cause).toBeUndefined();
	});
});
