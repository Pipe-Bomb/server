import { Test, TestingModule } from "@nestjs/testing";
import { AttributeSourcesService } from "./attribute-sources.service";

describe("AttributeSourcesService", () => {
	let service: AttributeSourcesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AttributeSourcesService],
		}).compile();

		service = module.get<AttributeSourcesService>(AttributeSourcesService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
