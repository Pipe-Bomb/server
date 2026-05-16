import { Test, TestingModule } from "@nestjs/testing";
import { PluginConfigService } from "./plugin-config.service";

describe("PluginConfigService", () => {
	let service: PluginConfigService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PluginConfigService],
		}).compile();

		service = module.get<PluginConfigService>(PluginConfigService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
