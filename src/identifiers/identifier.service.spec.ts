import { Test, TestingModule } from "@nestjs/testing";
import { IdentifiersService } from "./identifiers.service";

describe("IdentifierService", () => {
	let service: IdentifiersService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [IdentifiersService],
		}).compile();

		service = module.get<IdentifiersService>(IdentifiersService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
