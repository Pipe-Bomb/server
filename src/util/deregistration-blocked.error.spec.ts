import { DeregistrationBlockedError } from "./deregistration-blocked.error";

describe("DeregistrationBlockedError", () => {
	it("formats the message and exposes target and blockedBy", () => {
		const error = new DeregistrationBlockedError("plugin-a", [
			"track-1",
			"track-2",
		]);

		expect(error.message).toBe(
			'Cannot deregister "plugin-a": blocked by [track-1, track-2]',
		);
		expect(error.target).toBe("plugin-a");
		expect(error.blockedBy).toEqual(["track-1", "track-2"]);
		expect(error).toBeInstanceOf(DeregistrationBlockedError);
		expect(error).toBeInstanceOf(Error);
	});

	it("formats an empty blockedBy list", () => {
		const error = new DeregistrationBlockedError("plugin-b", []);

		expect(error.message).toBe('Cannot deregister "plugin-b": blocked by []');
		expect(error.blockedBy).toEqual([]);
	});
});
