import { Test, TestingModule } from "@nestjs/testing";
import { AudioSessionsController } from "./audio-sessions.controller";
import { AudioSessionsService } from "./audio-sessions.service";

describe("AudioSessionsController", () => {
	let controller: AudioSessionsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AudioSessionsController],
			providers: [AudioSessionsService],
		}).compile();

		controller = module.get<AudioSessionsController>(AudioSessionsController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
