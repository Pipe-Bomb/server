import { Test, TestingModule } from "@nestjs/testing";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { SetupService } from "./setup.service";

const mockUserManagerService = {
	count: jest.fn(),
};

describe("SetupService", () => {
	let service: SetupService;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SetupService,
				{ provide: UserManagerService, useValue: mockUserManagerService },
			],
		}).compile();
		service = module.get(SetupService);
	});

	it("reports setup as needed when no users exist", async () => {
		mockUserManagerService.count.mockResolvedValue(0);

		expect(await service.needsSetup()).toBe(true);
		expect(mockUserManagerService.count).toHaveBeenCalledTimes(1);
	});

	it("reports setup as complete when users exist", async () => {
		mockUserManagerService.count.mockResolvedValue(3);

		expect(await service.needsSetup()).toBe(false);
	});

	it("propagates count failures", async () => {
		mockUserManagerService.count.mockRejectedValue(new Error("db down"));

		await expect(service.needsSetup()).rejects.toThrow("db down");
	});
});
