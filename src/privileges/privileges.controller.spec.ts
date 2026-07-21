import { Test, TestingModule } from "@nestjs/testing";
import { PrivilegesController } from "./privileges.controller";
import { PrivilegesService } from "./privileges.service";

describe("PrivilegesController", () => {
	let controller: PrivilegesController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PrivilegesController],
			providers: [PrivilegesService],
		}).compile();

		controller = module.get<PrivilegesController>(PrivilegesController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
