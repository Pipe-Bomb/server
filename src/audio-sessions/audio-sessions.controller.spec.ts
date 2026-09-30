jest.mock("./audio-sessions.service", () => ({
	AudioSessionsService: class AudioSessionsService {},
}));

import { AudioSessionsController } from "./audio-sessions.controller";

describe("AudioSessionsController", () => {
	it("instantiates", () => {
		expect(new AudioSessionsController({} as any)).toBeDefined();
	});
});
