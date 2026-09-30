import { Test, TestingModule } from "@nestjs/testing";
import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";

const mockSetupService = {
	needsSetup: jest.fn(),
};

describe("SetupController", () => {
	let controller: SetupController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SetupController],
			providers: [{ provide: SetupService, useValue: mockSetupService }],
		}).compile();
		controller = module.get(SetupController);
	});

	it("returns needsSetup: true when setup is required", async () => {
		mockSetupService.needsSetup.mockResolvedValue(true);

		expect(await controller.getSetupStatus()).toEqual({ needsSetup: true });
		expect(mockSetupService.needsSetup).toHaveBeenCalledTimes(1);
	});

	it("returns needsSetup: false when setup is complete", async () => {
		mockSetupService.needsSetup.mockResolvedValue(false);

		expect(await controller.getSetupStatus()).toEqual({ needsSetup: false });
	});

	it("propagates setup service failures", async () => {
		mockSetupService.needsSetup.mockRejectedValue(new Error("db down"));

		await expect(controller.getSetupStatus()).rejects.toThrow("db down");
	});
});
