jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
		getExtension: jest.fn(),
	},
}));

import { AlbumsController } from "./albums.controller";
import { BadRequestException, NotFoundException } from "@nestjs/common";


describe("AlbumsController", () => {
	let controller: AlbumsController;
	let mockAlbumsService: any;
	let mockAlbumManagerService: any;
	let mockEphemeralService: any;
	let mockSearchSourcesService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockAlbumsService = { getAlbum: jest.fn(), getExternalUrls: jest.fn() };
		mockAlbumManagerService = {
			findOne: jest.fn(),
			findMany: jest.fn(),
			findManyRaw: jest.fn(),
			findIdentities: jest.fn(),
			resolveAlbum: jest.fn(),
			getExternalUrls: jest.fn(),
		};
		mockEphemeralService = {
			resolveEphemeralAlbum: jest.fn(),
			getAttributeSource: jest.fn(),
			toTracksResponse: jest.fn(),
			find: jest.fn(),
			getEphemeralAlbumSources: jest.fn(),
			getAlbumIdentifiers: jest.fn(),
			getEphemeralAlbumContent: jest.fn(),
			getEphemeralSourceByAlbumIdentity: jest.fn(),
		};
		mockSearchSourcesService = { hasSource: jest.fn(), search: jest.fn() };

		controller = new AlbumsController(
			mockAlbumsService,
			mockAlbumManagerService,
			mockEphemeralService,
			mockSearchSourcesService,
		);
	});

	describe("getAlbum", () => {
		it("returns album response when album is found", async () => {
			const album = { toResponse: () => ({ uuid: "album-1" }) };
			mockAlbumManagerService.findOne.mockResolvedValue(album);

			const result = await controller.getAlbum("album-uuid");

			expect(mockAlbumManagerService.findOne).toHaveBeenCalledWith("album-uuid", {
				withArtists: true,
				withArtistAttributes: true,
				withAttributes: true,
				withIdentities: true,
				withTracks: true,
				withTrackArtists: true,
				withTrackArtistAttributes: true,
				withTrackAttributes: true,
			});
			expect(result).toEqual({ uuid: "album-1" });
		});

		it("throws NotFoundException when album not found", async () => {
			mockAlbumManagerService.findOne.mockResolvedValue(null);

			await expect(controller.getAlbum("missing")).rejects.toThrow(NotFoundException);
		});
	});

	describe("getExternalUrls", () => {
		it("returns external URLs when album is found", async () => {
			const album = { toResponse: () => ({ uuid: "album-1" }) };
			mockAlbumManagerService.findOne.mockResolvedValue(album);
			const urls = [{ url: "http://a", name: "a", iconUrl: null }];
			mockAlbumManagerService.getExternalUrls.mockReturnValue(urls);

			const result = await controller.getExternalUrls("album-uuid");

			expect(mockAlbumManagerService.findOne).toHaveBeenCalledWith("album-uuid");
			expect(mockAlbumManagerService.getExternalUrls).toHaveBeenCalledWith(album);
			expect(result).toEqual(urls);
		});

		it("throws NotFoundException when album not found", async () => {
			mockAlbumManagerService.findOne.mockResolvedValue(null);

			await expect(controller.getExternalUrls("missing")).rejects.toThrow(NotFoundException);
		});
	});

	describe("search", () => {
		it("searches albums using SearchSourcesService when source available", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			const raw = {
				albums: ["uuid1", "uuid2"],
				albumTotal: 2,
			};
			mockSearchSourcesService.search.mockResolvedValue(raw);
			const fetched = [
				{ uuid: "uuid1", toResponse: () => ({ uuid: "uuid1" }) },
				{ uuid: "uuid2", toResponse: () => ({ uuid: "uuid2" }) },
		];
			mockAlbumManagerService.findMany.mockResolvedValue(fetched);

			const dto = { pageSize: 10, page: 1, sort: "name" };

			const result = await controller.search(dto);

			expect(mockSearchSourcesService.search).toHaveBeenCalledWith({
				sort: dto.sort,
				entities: { albums: { limit: dto.pageSize, page: dto.page } },
			});
			expect(mockAlbumManagerService.findMany).toHaveBeenCalledWith({
				where: {
					uuid: expect.objectContaining({ value: ["uuid1", "uuid2"] }),
				},
				withArtists: true,
				withAttributes: true,
				withIdentities: true,
				amount: 2,
			});
			expect(result.totalPages).toBe(1);
			expect(result.albums).toEqual([
				{ uuid: "uuid1" },
				{ uuid: "uuid2" },
		]);
		});

		it("searches albums using AlbumManagerService when no external source", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(false);
			const albums = [
				{ uuid: "a1", toResponse: () => ({ uuid: "a1" }) },
				{ uuid: "a2", toResponse: () => ({ uuid: "a2" }) },
		];
			mockAlbumManagerService.findMany.mockResolvedValue(albums);

			const dto = { pageSize: 10, page: 2, sort: "name" };

			const result = await controller.search(dto);

			expect(mockAlbumManagerService.findMany).toHaveBeenCalledWith({
				amount: dto.pageSize,
				offset: (dto.page - 1) * dto.pageSize,
				withAttributes: true,
				withIdentities: true,
				withArtists: true,
			});
			expect(result.totalPages).toBeNull();
			expect(result.albums).toEqual([
				{ uuid: "a1" },
				{ uuid: "a2" },
		]);
		});

		it("returns empty albums without fetching when source search has no results and no total", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			mockSearchSourcesService.search.mockResolvedValue({});

			const result = await controller.search({ pageSize: 10, page: 1, sort: "name" });

			expect(mockSearchSourcesService.search).toHaveBeenCalled();
			expect(mockAlbumManagerService.findMany).not.toHaveBeenCalled();
			expect(result).toEqual({ albums: [], totalPages: null });
		});

		it("filters out uuids that no longer resolve and computes totalPages", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			mockSearchSourcesService.search.mockResolvedValue({
				albums: ["uuid1", "missing-uuid"],
				albumTotal: 25,
			});
			mockAlbumManagerService.findMany.mockResolvedValue([
				{ uuid: "uuid1", toResponse: () => ({ uuid: "uuid1" }) },
		]);

			const result = await controller.search({ pageSize: 10, page: 1, sort: "name" });

			expect(result.totalPages).toBe(3);
			expect(result.albums).toEqual([{ uuid: "uuid1" }]);
		});
	});

	describe("getAlbumByIdentity", () => {
		it("resolves managed album and delegates to getAlbum", async () => {
			mockAlbumManagerService.resolveAlbum.mockResolvedValue("album-uuid");
			const album = { toResponse: () => ({ uuid: "album-1" }) };
			mockAlbumManagerService.findOne.mockResolvedValue(album);

			const result = await controller.getAlbumByIdentity(
				"plugin-1",
				"ident-1",
				"spotify:album:abc",
			);

			expect(mockAlbumManagerService.resolveAlbum).toHaveBeenCalledWith(
				"plugin-1",
				"ident-1",
				"spotify:album:abc",
			);
			expect(mockEphemeralService.resolveEphemeralAlbum).not.toHaveBeenCalled();
			expect(result).toEqual({ uuid: "album-1" });
		});

		it("falls back to ephemeral resolution when no managed album exists", async () => {
			mockAlbumManagerService.resolveAlbum.mockResolvedValue(null);
			const ephemeral = { uuid: "eph-1", tracks: [] };
			mockEphemeralService.resolveEphemeralAlbum.mockResolvedValue(ephemeral);

			const result = await controller.getAlbumByIdentity(
				"plugin-1",
				"ident-1",
				"identity",
			);

			expect(mockEphemeralService.resolveEphemeralAlbum).toHaveBeenCalledWith(
				"plugin-1",
				"ident-1",
				"identity",
			);
			expect(result).toEqual(ephemeral);
		});

		it("throws NotFoundException when neither managed nor ephemeral album is found", async () => {
			mockAlbumManagerService.resolveAlbum.mockResolvedValue(null);
			mockEphemeralService.resolveEphemeralAlbum.mockResolvedValue(null);

			await expect(
				controller.getAlbumByIdentity("plugin-1", "ident-1", "identity"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getAlbumEphemeralSources", () => {
		it("returns mapped ephemeral sources for the album", async () => {
			const album = { identities: [{ pluginId: "spotify", identifierId: "abc" }] };
			mockAlbumManagerService.findOne.mockResolvedValue(album);
			mockEphemeralService.getEphemeralAlbumSources.mockReturnValue([
				{
					source: { id: "src-1", getName: () => "Spotify" },
					plugin: { package: { name: "spotify" } },
				},
			]);

			const result = await controller.getAlbumEphemeralSources("album-uuid");

			expect(mockAlbumManagerService.findOne).toHaveBeenCalledWith("album-uuid", {
				withIdentities: true,
			});
			expect(mockEphemeralService.getEphemeralAlbumSources).toHaveBeenCalledWith(
				album.identities,
			);
			expect(result).toEqual([
				{ id: "src-1", pluginId: "spotify", name: "Spotify" },
			]);
		});

		it("throws NotFoundException when album not found", async () => {
			mockAlbumManagerService.findOne.mockResolvedValue(null);

			await expect(
				controller.getAlbumEphemeralSources("missing"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getAlbumEphemeralContent", () => {
		it("throws NotFoundException when the source does not exist", async () => {
			mockEphemeralService.find.mockReturnValue(null);

			await expect(
				controller.getAlbumEphemeralContent("album-uuid", {
					pluginId: "spotify",
					sourceId: "src-1",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when no identity is handled by the source", async () => {
			const source = { plugin: { package: { name: "spotify" } } };
			mockEphemeralService.find.mockReturnValue(source);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "deezer", identifierId: "x", identity: "id" },
			]);
			mockEphemeralService.getAlbumIdentifiers.mockReturnValue(["x"]);

			await expect(
				controller.getAlbumEphemeralContent("album-uuid", {
					pluginId: "spotify",
					sourceId: "src-1",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException when content is empty", async () => {
			const source = { plugin: { package: { name: "spotify" } } };
			mockEphemeralService.find.mockReturnValue(source);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "spotify", identifierId: "abc", identity: "spotify:album:abc" },
			]);
			mockEphemeralService.getAlbumIdentifiers.mockReturnValue(["abc"]);
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue(null);

			await expect(
				controller.getAlbumEphemeralContent("album-uuid", {
					pluginId: "spotify",
					sourceId: "src-1",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("returns content with empty tracks array when tracks are undefined", async () => {
			const source = {
				plugin: { package: { name: "spotify" } },
				source: { id: "src-1", getName: () => "Spotify" },
			};
			mockEphemeralService.find.mockReturnValue(source);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "spotify", identifierId: "abc", identity: "spotify:album:abc" },
			]);
			mockEphemeralService.getAlbumIdentifiers.mockReturnValue(["abc"]);
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue({
				source,
				tracks: undefined,
			});

			const result = await controller.getAlbumEphemeralContent("album-uuid", {
				pluginId: "spotify",
				sourceId: "src-1",
			});

			expect(mockEphemeralService.getEphemeralAlbumContent).toHaveBeenCalledWith(
				source,
				"abc",
				"spotify:album:abc",
			);
			expect(result).toEqual({
				source: { id: "src-1", pluginId: "spotify", name: "Spotify" },
				tracks: [],
			});
		});
	});

	describe("getAlbumEphemeralContentByIdentity", () => {
		it("throws NotFoundException when no source handles the identity", async () => {
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue(null);

			await expect(
				controller.getAlbumEphemeralContentByIdentity("plugin-1", "ident-1", "identity"),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when content is empty", async () => {
			const source = {};
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue(source);
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue(null);

			await expect(
				controller.getAlbumEphemeralContentByIdentity("plugin-1", "ident-1", "identity"),
			).rejects.toThrow(BadRequestException);
		});

		it("returns content with default empty tracks", async () => {
			const source = {
				plugin: { package: { name: "spotify" } },
				source: { id: "src-1", getName: () => "Spotify" },
			};
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue(source);
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue({
				source,
				tracks: [{ title: "Track 1" }],
			});

			const result = await controller.getAlbumEphemeralContentByIdentity(
				"spotify",
				"abc",
				"spotify:album:abc",
			);

			expect(mockEphemeralService.getEphemeralSourceByAlbumIdentity).toHaveBeenCalledWith(
				"spotify",
				"abc",
			);
			expect(mockEphemeralService.getEphemeralAlbumContent).toHaveBeenCalledWith(
				source,
				"abc",
				"spotify:album:abc",
			);
			expect(result).toEqual({
				source: { id: "src-1", pluginId: "spotify", name: "Spotify" },
				tracks: [{ title: "Track 1" }],
			});
		});
	});
});