import { Test, TestingModule } from "@nestjs/testing";
import { IconsController } from "./icons.controller";
import { IconsService } from "./icons.service";

describe("IconsController", () => {
	let controller: IconsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [IconsController],
			providers: [IconsService],
		}).compile();

		controller = module.get<IconsController>(IconsController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
