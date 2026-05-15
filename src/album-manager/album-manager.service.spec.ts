import { Test, TestingModule } from "@nestjs/testing";
import { AlbumManagerService } from "./album-manager.service";

describe("AlbumManagerService", () => {
	let service: AlbumManagerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AlbumManagerService],
		}).compile();

		service = module.get<AlbumManagerService>(AlbumManagerService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});
