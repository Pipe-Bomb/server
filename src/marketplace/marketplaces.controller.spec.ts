import { Test, TestingModule } from "@nestjs/testing";
import { MarketplacesController } from "./marketplaces.controller";
import { MarketplacesService } from "./marketplaces.service";
import { PrivilegesService } from "src/privileges/privileges.service";

jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

const mockMarketplaceService = {
	listMarketplaces: jest.fn(),
	addMarketplace: jest.fn(),
	removeMarketplace: jest.fn(),
	listPlugins: jest.fn(),
};
const mockPrivilegesService = {
	registerPrivilege: jest.fn(),
};

describe("MarketplacesController", () => {
	let controller: MarketplacesController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [MarketplacesController],
			providers: [
				{
					provide: MarketplacesService,
					useValue: mockMarketplaceService,
				},
				{ provide: PrivilegesService, useValue: mockPrivilegesService },
			],
		}).compile();
		controller = module.get(MarketplacesController);
	});

	it("registers the marketplace privileges in the constructor", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"modify-plugin-marketplaces",
		);
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"view-plugin-marketplaces",
			["modify-plugin-marketplaces"],
		);
	});

	it("listMarketplaces() delegates to the service", async () => {
		const list = [{ uuid: "mp-1" }];
		mockMarketplaceService.listMarketplaces.mockResolvedValue(list);

		expect(await controller.listMarketplaces()).toBe(list);
		expect(mockMarketplaceService.listMarketplaces).toHaveBeenCalledTimes(1);
	});

	it("addMarketplace() passes the dto url to the service", async () => {
		const response = { uuid: "mp-1" };
		mockMarketplaceService.addMarketplace.mockResolvedValue(response);

		expect(
			await controller.addMarketplace({
				url: "https://marketplace.example.com",
			}),
		).toBe(response);
		expect(mockMarketplaceService.addMarketplace).toHaveBeenCalledWith(
			"https://marketplace.example.com",
		);
	});

	it("removeMarketplace() delegates the uuid to the service", async () => {
		mockMarketplaceService.removeMarketplace.mockResolvedValue(undefined);

		await controller.removeMarketplace("mp-1");

		expect(mockMarketplaceService.removeMarketplace).toHaveBeenCalledWith(
			"mp-1",
		);
	});

	it("listPlugins() delegates to the service", async () => {
		const list = [{ id: "plugin-a" }];
		mockMarketplaceService.listPlugins.mockResolvedValue(list);

		expect(await controller.listPlugins()).toBe(list);
		expect(mockMarketplaceService.listPlugins).toHaveBeenCalledTimes(1);
	});
});
