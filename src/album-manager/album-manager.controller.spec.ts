import { AlbumManagerController } from "./album-manager.controller";

describe("AlbumManagerController", () => {
	let controller: AlbumManagerController;

	beforeEach(() => {
		controller = new AlbumManagerController({} as any);
	});

	it("instantiates", () => {
		expect(controller).toBeDefined();
	});
});
