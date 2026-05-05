import { Test, TestingModule } from "@nestjs/testing";
import { IconsService } from "./icons.service";

describe("IconsService", () => {
	let service: IconsService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [IconsService],
		}).compile();

		service = module.get<IconsService>(IconsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
