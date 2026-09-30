jest.mock("mime", () => ({
	__esModule: true,
	default: { getType: jest.fn() },
}));

import {
	BadRequestException,
	NotFoundException,
	StreamableFile,
} from "@nestjs/common";
import { EphemeralController } from "./ephemeral.controller";
import mime from "mime";

describe("EphemeralController", () => {
	let controller: EphemeralController;
	let ephemeralService: any;
	let attributeSourcesService: any;
	let resourcesService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		(
			mime.getType as jest.Mock
		).mockReturnValue("image/png");
		ephemeralService = {
			allFlat: jest.fn().mockReturnValue([]),
			find: jest.fn(),
			search: jest.fn().mockResolvedValue({
				tracks: [],
				artists: [],
				albums: [],
				attributeSource: null,
			}),
			toTracksResponse: jest.fn().mockResolvedValue([]),
			toArtistsResponse: jest.fn().mockResolvedValue([]),
			toAlbumsResponse: jest.fn().mockResolvedValue([]),
			getProxiedAttribute: jest.fn(),
		};
		attributeSourcesService = {};
		resourcesService = {
			sanitizeDimension: jest.fn().mockReturnValue(null),
			resizeImage: jest.fn().mockResolvedValue(Buffer.from("webp")),
		};

		controller = new EphemeralController(
			ephemeralService,
			attributeSourcesService,
			resourcesService,
		);
	});

	describe("getAll", () => {
		it("returns a response for each source", () => {
			ephemeralService.allFlat.mockReturnValue([
				{
					source: { id: "src-1", getName: () => "Source" },
					plugin: { package: { name: "plug-a" } },
				},
			]);

			expect(controller.getAll()).toEqual([
				{ id: "src-1", pluginId: "plug-a", name: "Source" },
			]);
		});
	});

	describe("search", () => {
		it("throws NotFoundException for an unknown source", async () => {
			ephemeralService.find.mockReturnValue(null);
			await expect(
				controller.search({ pluginId: "plug-a", sourceId: "x" } as any),
			).rejects.toThrow(NotFoundException);
		});

		it("returns tracks, artists and albums", async () => {
			const source = { source: { id: "src-1" }, plugin: { package: { name: "plug-a" } } };
			ephemeralService.find.mockReturnValue(source);
			ephemeralService.toTracksResponse.mockResolvedValue([{ trackId: "t1" }]);
			ephemeralService.toArtistsResponse.mockResolvedValue([{ uuid: "a1" }]);
			ephemeralService.toAlbumsResponse.mockResolvedValue([{ uuid: "al1" }]);

			const result = await controller.search({
				pluginId: "plug-a",
				sourceId: "src-1",
				query: "q",
			} as any);

			expect(ephemeralService.search).toHaveBeenCalledWith(source, {
				query: "q",
			});
			expect(result).toEqual({
				tracks: [{ trackId: "t1" }],
				artists: [{ uuid: "a1" }],
				albums: [{ uuid: "al1" }],
			});
		});
	});

	describe("getAttributeBuffer", () => {
		it("throws NotFoundException for an unknown attribute", async () => {
			ephemeralService.getProxiedAttribute.mockReturnValue(null);
			await expect(
				controller.getAttributeBuffer("abc.png"),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when the mime type is unknown", async () => {
			(mime.getType as jest.Mock).mockReturnValue(null);
			ephemeralService.getProxiedAttribute.mockReturnValue({
				extension: "png",
				buffer: Buffer.from("data"),
			});
			await expect(
				controller.getAttributeBuffer("abc.png"),
			).rejects.toThrow(BadRequestException);
		});

		it("serves the buffer with its mime type", async () => {
			ephemeralService.getProxiedAttribute.mockReturnValue({
				extension: "png",
				buffer: Buffer.from("data"),
			});

			const result = await controller.getAttributeBuffer("abc.png");

			expect(result).toBeInstanceOf(StreamableFile);
			expect(result.getHeaders().type).toBe("image/png");
		});

		it("resolves a buffer provided as a lazy function", async () => {
			ephemeralService.getProxiedAttribute.mockReturnValue({
				extension: "png",
				buffer: jest.fn().mockResolvedValue(Buffer.from("lazy")),
			});

			const result = await controller.getAttributeBuffer("abc.png");
			expect(result.getHeaders().type).toBe("image/png");
		});

		it("resizes and returns webp when a dimension is provided", async () => {
			ephemeralService.getProxiedAttribute.mockReturnValue({
				extension: "png",
				buffer: Buffer.from("data"),
			});
			resourcesService.sanitizeDimension
				.mockReturnValueOnce(100)
				.mockReturnValueOnce(null);

			const result = await controller.getAttributeBuffer("abc.png", "100");

			expect(resourcesService.resizeImage).toHaveBeenCalled();
			expect(result.getHeaders().type).toBe("image/webp");
		});
	});
});
