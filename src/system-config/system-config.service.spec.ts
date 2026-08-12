import { Test, TestingModule } from "@nestjs/testing";
import { SystemConfigService } from "./system-config.service";

describe("SystemConfigService", () => {
	let service: SystemConfigService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SystemConfigService],
		}).compile();

		service = module.get<SystemConfigService>(SystemConfigService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
