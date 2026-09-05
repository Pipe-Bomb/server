import { Test, TestingModule } from "@nestjs/testing";
import { PlaybackHistoryService } from "./playback-history.service";

describe("PlaybackHistoryService", () => {
	let service: PlaybackHistoryService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PlaybackHistoryService],
		}).compile();

		service = module.get<PlaybackHistoryService>(PlaybackHistoryService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
