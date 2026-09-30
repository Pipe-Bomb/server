import { ErrorResponse } from "./error.response";

describe("ErrorResponse", () => {
	it("is a plain data class with exactly error, message and statusCode", () => {
		const response = new ErrorResponse();
		response.error = "unauthorized";
		response.message = "Authentication token missing";
		response.statusCode = 401;

		expect(response).toBeInstanceOf(ErrorResponse);
		expect(response.error).toBe("unauthorized");
		expect(response.message).toBe("Authentication token missing");
		expect(response.statusCode).toBe(401);
		expect(Object.keys(response).sort()).toEqual([
			"error",
			"message",
			"statusCode",
		]);
	});

	it("exposes no own methods on its prototype", () => {
		const members = Object.getOwnPropertyNames(ErrorResponse.prototype).filter(
			(name) => name !== "constructor",
		);

		expect(members).toEqual([]);
	});
});
