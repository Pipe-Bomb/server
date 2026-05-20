import { Test, TestingModule } from "@nestjs/testing";
import { EphemeralController } from "./ephemeral.controller";
import { EphemeralService } from "./ephemeral.service";

describe("EphemeralController", () => {
	let controller: EphemeralController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EphemeralController],
			providers: [EphemeralService],
		}).compile();

		controller = module.get<EphemeralController>(EphemeralController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
