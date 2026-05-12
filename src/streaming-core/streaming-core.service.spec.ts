import { Test, TestingModule } from "@nestjs/testing";
import { StreamingCoreService } from "./streaming-core.service";

describe("StreamingCoreService", () => {
	let service: StreamingCoreService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [StreamingCoreService],
		}).compile();

		service = module.get<StreamingCoreService>(StreamingCoreService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
