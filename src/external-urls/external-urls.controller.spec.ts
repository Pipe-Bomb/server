import { Test, TestingModule } from "@nestjs/testing";
import { ExternalUrlsController } from "./external-urls.controller";
import { ExternalUrlsService } from "./external-urls.service";

describe("ExternalUrlsController", () => {
	let controller: ExternalUrlsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ExternalUrlsController],
			providers: [ExternalUrlsService],
		}).compile();

		controller = module.get<ExternalUrlsController>(ExternalUrlsController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
