import { Test, TestingModule } from "@nestjs/testing";
import { ArtistManagerService } from "./artist-manager.service";

describe("ArtistManagerService", () => {
	let service: ArtistManagerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ArtistManagerService],
		}).compile();

		service = module.get<ArtistManagerService>(ArtistManagerService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
