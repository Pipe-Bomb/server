import { Test, TestingModule } from "@nestjs/testing";
import { ArtistManagerController } from "./artist-manager.controller";
import { ArtistManagerService } from "./artist-manager.service";

describe("ArtistManagerController", () => {
	let controller: ArtistManagerController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ArtistManagerController],
			providers: [ArtistManagerService],
		}).compile();

		controller = module.get<ArtistManagerController>(ArtistManagerController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});
});
