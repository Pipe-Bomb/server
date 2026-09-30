jest.mock("./audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

import { AudioCacheController } from "./audio-cache.controller";

describe("AudioCacheController", () => {
	it("instantiates", () => {
		expect(new AudioCacheController({} as any)).toBeDefined();
	});
});
