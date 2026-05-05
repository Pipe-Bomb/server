import { Test, TestingModule } from "@nestjs/testing";
import { TrackManagerController } from "./track-manager.controller";
import { TrackManagerService } from "./track-manager.service";

describe("TrackManagerController", () => {
	let controller: TrackManagerController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TrackManagerController],
			providers: [TrackManagerService],
		}).compile();

		controller = module.get<TrackManagerController>(TrackManagerController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
