import { Test, TestingModule } from "@nestjs/testing";
import { AttributeSourcesController } from "./attribute-sources.controller";
import { AttributeSourcesService } from "./attribute-sources.service";

describe("AttributeSourcesController", () => {
	let controller: AttributeSourcesController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AttributeSourcesController],
			providers: [AttributeSourcesService],
		}).compile();

		controller = module.get<AttributeSourcesController>(
			AttributeSourcesController,
		);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
