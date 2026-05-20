import { Test, TestingModule } from "@nestjs/testing";
import { EphemeralService } from "./ephemeral.service";

describe("EphemeralService", () => {
	let service: EphemeralService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [EphemeralService],
		}).compile();

		service = module.get<EphemeralService>(EphemeralService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
