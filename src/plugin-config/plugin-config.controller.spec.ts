import { Test, TestingModule } from "@nestjs/testing";
import { PluginConfigController } from "./plugin-config.controller";
import { PluginConfigService } from "./plugin-config.service";

describe("PluginConfigController", () => {
	let controller: PluginConfigController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PluginConfigController],
			providers: [PluginConfigService],
		}).compile();

		controller = module.get<PluginConfigController>(PluginConfigController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
