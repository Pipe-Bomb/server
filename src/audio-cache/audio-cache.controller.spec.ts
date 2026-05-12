import { Test, TestingModule } from "@nestjs/testing";
import { AudioCacheController } from "./audio-cache.controller";
import { AudioCacheService } from "./audio-cache.service";

describe("AudioCacheController", () => {
	let controller: AudioCacheController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AudioCacheController],
			providers: [AudioCacheService],
		}).compile();

		controller = module.get<AudioCacheController>(AudioCacheController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
