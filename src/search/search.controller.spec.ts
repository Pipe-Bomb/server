import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SearchSourcesService } from "./search-sources.service";
import { PrivilegesService } from "src/privileges/privileges.service";

describe("SearchController", () => {
	let controller: SearchController;
	let mockSearchService: { search: jest.Mock };
	let mockSearchSourcesService: {
		getAll: jest.Mock;
		setActive: jest.Mock;
		clearActive: jest.Mock;
		getLoaded: jest.Mock;
	};
	let mockPrivilegesService: { registerPrivilege: jest.Mock };

	beforeEach(() => {
		mockSearchService = { search: jest.fn() };
		mockSearchSourcesService = {
			getAll: jest.fn().mockReturnValue([]),
			setActive: jest.fn().mockResolvedValue(undefined),
			clearActive: jest.fn().mockResolvedValue(undefined),
			getLoaded: jest.fn(),
		};
		mockPrivilegesService = { registerPrivilege: jest.fn() };

		controller = new SearchController(
			mockSearchService as any,
			mockSearchSourcesService as any,
			mockPrivilegesService as any,
		);
	});

	it("registers privileges on construction", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"select-search-source",
		);
	});

	describe("search", () => {
		it("maps dto to service call and returns responses", async () => {
			mockSearchService.search.mockResolvedValue({
				tracks: [{ toResponse: () => ({ uuid: "t1" }) }],
				artists: [{ toResponse: () => ({ uuid: "a1" }) }],
				albums: [{ toResponse: () => ({ uuid: "al1" }) }],
			});

			const result = await controller.search({
				query: "rock",
				withTracks: true,
				withArtists: true,
				withAlbums: true,
				attributes: [],
			} as any);

			expect(result).toEqual({
				tracks: [{ uuid: "t1" }],
				artists: [{ uuid: "a1" }],
				albums: [{ uuid: "al1" }],
			});
			expect(mockSearchService.search).toHaveBeenCalledWith(
				expect.objectContaining({
					query: "rock",
					trackAmount: 30,
					artistAmount: 10,
					albumAmount: 20,
				}),
			);
		});
	});

	describe("getSearchSources", () => {
		it("returns all sources", () => {
			mockSearchSourcesService.getAll.mockReturnValue([
				{ pluginId: "p1", sourceId: "s1" },
			]);
			expect(controller.getSearchSources()).toEqual([
				{ pluginId: "p1", sourceId: "s1" },
			]);
		});
	});

	describe("setActiveSearchSource", () => {
		it("delegates to service", async () => {
			await controller.setActiveSearchSource({
				pluginId: "p1",
				sourceId: "s1",
			} as any);
			expect(mockSearchSourcesService.setActive).toHaveBeenCalledWith(
				"p1",
				"s1",
			);
		});
	});

	describe("clearActiveSearchSource", () => {
		it("delegates to service", async () => {
			await controller.clearActiveSearchSource();
			expect(mockSearchSourcesService.clearActive).toHaveBeenCalled();
		});
	});

	describe("getSearchSource", () => {
		it("returns null when no source loaded", () => {
			mockSearchSourcesService.getLoaded.mockReturnValue(null);
			expect(controller.getSearchSource()).toBeNull();
		});

		it("returns loaded source with capabilities", () => {
			mockSearchSourcesService.getLoaded.mockReturnValue({
				plugin: { package: { name: "plug" } },
				source: {
					id: "s1",
					getName: () => "My Source",
					getCapabilities: jest.fn().mockReturnValue({
						sortMethods: [{ key: "title", ascending: true, descending: true }],
						filterableAttributes: [
							{
								entityType: "track",
								attributeKey: "genre",
								attributeType: "string",
								supportsFuzzy: true,
							},
						],
					}),
				},
			});

			const result = controller.getSearchSource();
			expect(result).toEqual(
				expect.objectContaining({
					pluginId: "plug",
					sourceId: "s1",
					name: "My Source",
				}),
			);
		});
	});
});
