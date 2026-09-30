jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

import {
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import { LibrariesController } from "./libraries.controller";

describe("LibrariesController", () => {
	let controller: LibrariesController;
	let librariesService: any;
	let attributeSourcesService: any;
	let searchSourcesService: any;
	let trackManagerService: any;

	beforeEach(() => {
		librariesService = {
			allFlat: jest.fn().mockReturnValue([]),
			findLibrary: jest.fn(),
			getTrackUuids: jest.fn().mockResolvedValue([]),
			findTracks: jest.fn().mockResolvedValue({ tracks: [] }),
		};
		attributeSourcesService = {};
		searchSourcesService = {
			hasSource: jest.fn().mockReturnValue(false),
			search: jest.fn(),
		};
		trackManagerService = {
			find: jest.fn().mockResolvedValue([]),
		};

		controller = new LibrariesController(
			librariesService,
			attributeSourcesService,
			searchSourcesService,
			trackManagerService,
		);
	});

	describe("all", () => {
		it("returns a name for each registered library", () => {
			librariesService.allFlat.mockReturnValue([
				{
					id: "lib-1",
					handler: { id: "lib-1", getName: () => "My Library" },
					plugin: { package: { name: "plug-a" } },
				},
			]);

			expect(controller.all()).toEqual([
				{ pluginId: "plug-a", id: "lib-1", name: "My Library" },
			]);
		});

		it("throws InternalServerErrorException when getName throws", () => {
			librariesService.allFlat.mockReturnValue([
				{
					id: "lib-1",
					handler: {
						id: "lib-1",
						getName: () => {
							throw new Error("boom");
						},
					},
					plugin: { package: { name: "plug-a" } },
				},
			]);

			expect(() => controller.all()).toThrow(InternalServerErrorException);
		});
	});

	describe("get", () => {
		it("throws NotFoundException for an unknown library", () => {
			librariesService.findLibrary.mockReturnValue(null);
			expect(() => controller.get("plug-a", "missing")).toThrow(
				NotFoundException,
			);
		});

		it("returns the library descriptor", () => {
			librariesService.findLibrary.mockReturnValue({
				id: "lib-1",
				handler: { id: "lib-1", getName: () => "My Library" },
				plugin: { package: { name: "plug-a" } },
			});

			expect(controller.get("plug-a", "lib-1")).toEqual({
				id: "lib-1",
				name: "My Library",
				pluginId: "plug-a",
			});
		});
	});

	describe("search", () => {
		const dto = { pageSize: 10, page: 1 } as any;

		it("throws NotFoundException for an unknown library", async () => {
			librariesService.findLibrary.mockReturnValue(null);
			await expect(
				controller.search("plug-a", "missing", dto),
			).rejects.toThrow(NotFoundException);
		});

		it("uses the search source when one is active", async () => {
			librariesService.findLibrary.mockReturnValue({ id: "lib-1" });
			searchSourcesService.hasSource.mockReturnValue(true);
			librariesService.getTrackUuids.mockResolvedValue(["u1"]);
			searchSourcesService.search.mockResolvedValue({
				tracks: ["u1"],
				trackTotal: 1,
			});
			trackManagerService.find.mockResolvedValue([
				{ uuid: "u1", toResponse: () => ({ uuid: "u1" }) },
			]);

			const result = await controller.search("plug-a", "lib-1", dto);

			expect(searchSourcesService.search).toHaveBeenCalled();
			expect(result).toEqual({
				tracks: [{ uuid: "u1" }],
				totalPages: 1,
			});
		});

		it("falls back to the library track finder", async () => {
			librariesService.findLibrary.mockReturnValue({ id: "lib-1" });
			searchSourcesService.hasSource.mockReturnValue(false);
			librariesService.findTracks.mockResolvedValue({
				tracks: [{ toResponse: () => ({ uuid: "u1" }) }],
			});

			const result = await controller.search("plug-a", "lib-1", dto);

			expect(librariesService.findTracks).toHaveBeenCalledWith(
				{ id: "lib-1" },
				expect.objectContaining({ amount: 10, withAttributes: true }),
			);
			expect(result).toEqual({ tracks: [{ uuid: "u1" }] });
		});
	});
});
