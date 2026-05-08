import { Test, TestingModule } from "@nestjs/testing";
import { AudioSessionsService } from "./audio-sessions.service";

describe("AudioSessionsService", () => {
	let service: AudioSessionsService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AudioSessionsService],
		}).compile();

		service = module.get<AudioSessionsService>(AudioSessionsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
