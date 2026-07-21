import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UserManagerService } from "./users.service";

describe("UsersController", () => {
	let controller: UsersController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [UserManagerService],
		}).compile();

		controller = module.get<UsersController>(UsersController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
