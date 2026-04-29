import { Test, TestingModule } from "@nestjs/testing";
import { IdentifierController } from "./identifiers.controller";
import { IdentifierService } from "./identifiers.service";

describe("IdentifierController", () => {
	let controller: IdentifierController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [IdentifierController],
			providers: [IdentifierService],
		}).compile();

		controller = module.get<IdentifierController>(IdentifierController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
