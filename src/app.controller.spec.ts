jest.mock("./app.service", () => ({ AppService: class {} }));

import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
	let controller: AppController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [{ provide: AppService, useValue: {} }],
		}).compile();
		controller = module.get(AppController);
	});

	it("returns the server banner from the root endpoint", () => {
		expect(controller.get()).toBe("Pipe Bomb server");
	});
});
