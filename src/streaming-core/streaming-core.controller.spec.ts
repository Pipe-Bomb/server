import { Test, TestingModule } from "@nestjs/testing";
import { StreamingCoreController } from "./streaming-core.controller";
import { StreamingCoreService } from "./streaming-core.service";

describe("StreamingCoreController", () => {
	let controller: StreamingCoreController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [StreamingCoreController],
			providers: [StreamingCoreService],
		}).compile();

		controller = module.get<StreamingCoreController>(StreamingCoreController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
