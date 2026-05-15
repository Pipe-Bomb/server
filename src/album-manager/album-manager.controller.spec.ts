import { Test, TestingModule } from "@nestjs/testing";
import { AlbumManagerController } from "./album-manager.controller";
import { AlbumManagerService } from "./album-manager.service";

describe("AlbumManagerController", () => {
	let controller: AlbumManagerController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AlbumManagerController],
			providers: [AlbumManagerService],
		}).compile();

		controller = module.get<AlbumManagerController>(AlbumManagerController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
