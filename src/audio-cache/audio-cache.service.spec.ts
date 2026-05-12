import { Test, TestingModule } from "@nestjs/testing";
import { AudioCacheService } from "./audio-cache.service";

describe("AudioCacheService", () => {
	let service: AudioCacheService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AudioCacheService],
		}).compile();

		service = module.get<AudioCacheService>(AudioCacheService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
