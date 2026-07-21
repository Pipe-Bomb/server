import { Test, TestingModule } from "@nestjs/testing";
import { PrivilegesService } from "./privileges.service";

describe("PrivilegesService", () => {
	let service: PrivilegesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PrivilegesService],
		}).compile();

		service = module.get<PrivilegesService>(PrivilegesService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
