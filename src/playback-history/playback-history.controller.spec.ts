import { Test, TestingModule } from "@nestjs/testing";
import { PlaybackHistoryController } from "./playback-history.controller";
import { PlaybackHistoryService } from "./playback-history.service";

describe("PlaybackHistoryController", () => {
	let controller: PlaybackHistoryController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PlaybackHistoryController],
			providers: [PlaybackHistoryService],
		}).compile();

		controller = module.get<PlaybackHistoryController>(
			PlaybackHistoryController,
		);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
