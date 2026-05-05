import { Test, TestingModule } from "@nestjs/testing";
import { ExternalUrlsService } from "./external-urls.service";

describe("ExternalUrlsService", () => {
	let service: ExternalUrlsService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ExternalUrlsService],
		}).compile();

		service = module.get<ExternalUrlsService>(ExternalUrlsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
