import { Test, TestingModule } from "@nestjs/testing";
import { UserManagerService } from "./user-manager.service";

describe("UserManagerService", () => {
	let service: UserManagerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [UserManagerService],
		}).compile();

		service = module.get<UserManagerService>(UserManagerService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
