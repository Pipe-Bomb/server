import { Test, TestingModule } from "@nestjs/testing";
import { TrackManagerService } from "./track-manager.service";

describe("TrackManagerService", () => {
	let service: TrackManagerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TrackManagerService],
		}).compile();

		service = module.get<TrackManagerService>(TrackManagerService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
