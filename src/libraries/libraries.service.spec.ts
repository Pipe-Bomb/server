import { Test, TestingModule } from "@nestjs/testing";
import { LibrariesService } from "./libraries.service";

describe("LibrariesService", () => {
	let service: LibrariesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [LibrariesService],
		}).compile();

		service = module.get<LibrariesService>(LibrariesService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
