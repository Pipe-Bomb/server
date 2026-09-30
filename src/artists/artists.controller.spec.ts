import { ArtistsController } from "./artists.controller";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ArtistIdentityTarget } from "../artist-manager/enum/artist-identity-target.enum";


describe("ArtistsController", () => {
	let controller: ArtistsController;
	let mockArtistsService: any;
	let mockArtistManagerService: any;
	let mockEphemeralService: any;
	let mockAttributesService: any;
	let mockSearchSourcesService: any;
	let mockDisabledIdentifiersService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockArtistsService = { getArtist: jest.fn(), updateArtistMetadata: jest.fn() };
		mockArtistManagerService = {
			findOne: jest.fn(),
			findMany: jest.fn(),
			findManyRaw: jest.fn(),
			identifyArtist: jest.fn(),
			resolveArtist: jest.fn(),
			findIdentities: jest.fn(),
			getExternalUrls: jest.fn(),
		};
		mockEphemeralService = {
			find: jest.fn(),
			getEphemeralArtistContent: jest.fn(),
			getEphemeralArtistSources: jest.fn(),
			getEphemeralSourceByArtistIdentity: jest.fn(),
			resolveEphemeralArtist: jest.fn(),
			getArtistIdentifiers: jest.fn(),
		};
		mockAttributesService = { attributeArtist: jest.fn() };
		mockSearchSourcesService = { hasSource: jest.fn(), search: jest.fn() };
		mockDisabledIdentifiersService = { getDisabledSet: jest.fn() };

		controller = new ArtistsController(
			mockArtistsService,
			mockArtistManagerService,
			mockEphemeralService,
			mockAttributesService,
			mockSearchSourcesService,
			mockDisabledIdentifiersService,
		);
	});

	describe("getArtist", () => {
		it("returns artist response when artist is found", async () => {
			const artist = { toResponse: () => ({ uuid: "artist-1" }) };
			mockArtistManagerService.findOne.mockResolvedValue(artist);

			const result = await controller.getArtist("artist-uuid");

			expect(mockArtistManagerService.findOne).toHaveBeenCalledWith("artist-uuid", {
				withAttributes: true,
				withIdentities: true,
				withTracks: 10,
				withTrackArtists: true,
				withTrackAttributes: true,
				withTrackAlbums: true,
				withAlbums: true,
				withAlbumArtists: true,
				withAlbumArtistAttributes: true,
				withAlbumAttributes: true,
			});
			expect(result).toEqual({ uuid: "artist-1" });
		});

		it("throws NotFoundException when artist not found", async () => {
			mockArtistManagerService.findOne.mockResolvedValue(null);

			await expect(controller.getArtist("missing")).rejects.toThrow(NotFoundException);
		});
	});

	describe("updateArtistMetadata", () => {
		it("throws NotFoundException when artist not found", async () => {
			mockArtistManagerService.findOne.mockResolvedValue(null);

			await expect(controller.updateArtistMetadata("missing")).rejects.toThrow(NotFoundException);
		});

		it("identifies, attributes, and returns the updated artist", async () => {
			const artist = { uuid: "artist-1", toResponse: () => ({ uuid: "artist-1" }) };
			mockArtistManagerService.findOne.mockResolvedValue(artist);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(new Set(["disc"]));
			mockArtistManagerService.identifyArtist.mockResolvedValue({ identities: 3 });
			mockAttributesService.attributeArtist.mockResolvedValue(undefined);

			const result = await controller.updateArtistMetadata("artist-1");

			expect(mockDisabledIdentifiersService.getDisabledSet).toHaveBeenCalled();
			expect(mockArtistManagerService.identifyArtist).toHaveBeenCalledWith(
				artist,
				expect.any(String),
				new Set(["disc"]),
			);
			expect(mockAttributesService.attributeArtist).toHaveBeenCalledWith(artist);
			expect(mockArtistManagerService.findOne).toHaveBeenCalledTimes(2);
			expect(result).toEqual({ uuid: "artist-1" });
		});
	});

	describe("getArtistByIdentity", () => {
		it("resolves artist uuid via resolveArtist and returns the artist", async () => {
			mockArtistManagerService.resolveArtist.mockResolvedValue("resolved-uuid");
			const artist = { toResponse: () => ({ uuid: "resolved-uuid" }) };
			mockArtistManagerService.findOne.mockResolvedValue(artist);

			const result = await controller.getArtistByIdentity("plugin-1", "ident-1", "identity-1");

			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plugin-1",
				"ident-1",
				"identity-1",
				ArtistIdentityTarget.ARTIST,
			);
			expect(result).toEqual({ uuid: "resolved-uuid" });
		});

		it("falls back to ephemeral artist when resolveArtist returns null", async () => {
			mockArtistManagerService.resolveArtist.mockResolvedValue(null);
			const ephemeralArtist = { uuid: "ephemeral-1" };
			mockEphemeralService.resolveEphemeralArtist.mockResolvedValue(ephemeralArtist);

			const result = await controller.getArtistByIdentity("plugin-1", "ident-1", "identity-1");

			expect(mockEphemeralService.resolveEphemeralArtist).toHaveBeenCalledWith(
				"plugin-1",
				"ident-1",
				"identity-1",
			);
			expect(result).toEqual(ephemeralArtist);
		});

		it("throws NotFoundException when neither resolve path finds an artist", async () => {
			mockArtistManagerService.resolveArtist.mockResolvedValue(null);
			mockEphemeralService.resolveEphemeralArtist.mockResolvedValue(null);

			await expect(controller.getArtistByIdentity("plugin-1", "ident-1", "identity-1")).rejects.toThrow(NotFoundException);
		});
	});

	describe("getArtistEphemeralSources", () => {
		it("returns mapped ephemeral sources for the artist", async () => {
			const artist = { uuid: "artist-1", identities: [{ pluginId: "plugin-1", identifierId: "i1" }] };
			mockArtistManagerService.findOne.mockResolvedValue(artist);
			mockEphemeralService.getEphemeralArtistSources.mockReturnValue([
				{
					source: { id: "s1", getName: () => "Source One" },
					plugin: { package: { name: "plugin-1" } },
				},
			]);

			const result = await controller.getArtistEphemeralSources("artist-1");

			expect(mockArtistManagerService.findOne).toHaveBeenCalledWith("artist-1", {
				withIdentities: true,
			});
			expect(mockEphemeralService.getEphemeralArtistSources).toHaveBeenCalledWith(artist.identities);
			expect(result).toEqual([
				{ id: "s1", pluginId: "plugin-1", name: "Source One" },
			]);
		});

		it("throws NotFoundException when artist not found", async () => {
			mockArtistManagerService.findOne.mockResolvedValue(null);

			await expect(controller.getArtistEphemeralSources("missing")).rejects.toThrow(NotFoundException);
		});

		it("throws InternalServerErrorException when source getName throws", async () => {
			const artist = { uuid: "artist-1", identities: [] };
			mockArtistManagerService.findOne.mockResolvedValue(artist);
			mockEphemeralService.getEphemeralArtistSources.mockReturnValue([
				{
					source: { id: "s1", getName: () => { throw new Error("boom"); } },
					plugin: { package: { name: "plugin-1" } },
				},
			]);

			await expect(controller.getArtistEphemeralSources("artist-1")).rejects.toThrow(InternalServerErrorException);
		});
	});

	describe("getArtistEphemeralContent", () => {
		const source = {
			id: "s1",
			plugin: { package: { name: "plugin-1" } },
		};

		it("throws NotFoundException when source does not exist", async () => {
			mockEphemeralService.find.mockReturnValue(null);
			const dto = { pluginId: "plugin-1", sourceId: "s1" };

			await expect(controller.getArtistEphemeralContent("artist-1", dto)).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when no identity matches the source", async () => {
			mockEphemeralService.find.mockReturnValue(source);
			mockArtistManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "other-plugin", identifierId: "i1", identity: "id-1" },
			]);
			mockEphemeralService.getArtistIdentifiers.mockReturnValue(["i1"]);

			const dto = { pluginId: "plugin-1", sourceId: "s1" };

			await expect(controller.getArtistEphemeralContent("artist-1", dto)).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException when content is null", async () => {
			mockEphemeralService.find.mockReturnValue(source);
			mockArtistManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "plugin-1", identifierId: "i1", identity: "id-1" },
			]);
			mockEphemeralService.getArtistIdentifiers.mockReturnValue(["i1"]);
			mockEphemeralService.getEphemeralArtistContent.mockResolvedValue(null);

			const dto = { pluginId: "plugin-1", sourceId: "s1" };

			await expect(controller.getArtistEphemeralContent("artist-1", dto)).rejects.toThrow(BadRequestException);
		});

		it("returns source and content for a matching identity", async () => {
			mockEphemeralService.find.mockReturnValue(source);
			mockArtistManagerService.findIdentities.mockResolvedValue([
				{ pluginId: "plugin-1", identifierId: "i1", identity: "id-1" },
			]);
			mockEphemeralService.getArtistIdentifiers.mockReturnValue(["i1"]);
			mockEphemeralService.getEphemeralArtistContent.mockResolvedValue({
				source: {
					source: { id: "s1", getName: () => "Source One" },
					plugin: { package: { name: "plugin-1" } },
				},
				tracks: ["t1"],
				albums: ["a1"],
			});

			const dto = { pluginId: "plugin-1", sourceId: "s1" };
			const result = await controller.getArtistEphemeralContent("artist-1", dto);

			expect(mockEphemeralService.getEphemeralArtistContent).toHaveBeenCalledWith(source, "i1", "id-1");
			expect(result).toEqual({
				source: { id: "s1", pluginId: "plugin-1", name: "Source One" },
				tracks: ["t1"],
				albums: ["a1"],
			});
		});
	});

	describe("getArtistEphemeralContentByIdentity", () => {
		it("throws BadRequestException when no source handles the identity", async () => {
			mockEphemeralService.getEphemeralSourceByArtistIdentity.mockReturnValue(null);

			await expect(controller.getArtistEphemeralContentByIdentity("plugin-1", "i1", "id-1")).rejects.toThrow(BadRequestException);
		});

		it("returns source and content, defaulting tracks/albums to empty arrays", async () => {
			const source = { id: "s1", plugin: { package: { name: "plugin-1" } } };
			mockEphemeralService.getEphemeralSourceByArtistIdentity.mockReturnValue(source);
			mockEphemeralService.getEphemeralArtistContent.mockResolvedValue({
				source: {
					source: { id: "s1", getName: () => "Source One" },
					plugin: { package: { name: "plugin-1" } },
				},
				tracks: undefined,
				albums: undefined,
			});

			const result = await controller.getArtistEphemeralContentByIdentity("plugin-1", "i1", "id-1");

			expect(mockEphemeralService.getEphemeralArtistContent).toHaveBeenCalledWith(source, "i1", "id-1");
			expect(result).toEqual({
				source: { id: "s1", pluginId: "plugin-1", name: "Source One" },
				tracks: [],
				albums: [],
			});
		});
	});

	describe("getExternalUrls", () => {
		it("returns external urls for the artist", async () => {
			const artist = { uuid: "artist-1" };
			mockArtistManagerService.findOne.mockResolvedValue(artist);
			const urls = [{ url: "https://example.com/artist-1" }];
			mockArtistManagerService.getExternalUrls.mockReturnValue(urls);

			const result = await controller.getExternalUrls("artist-1");

			expect(mockArtistManagerService.getExternalUrls).toHaveBeenCalledWith(artist);
			expect(result).toEqual(urls);
		});

		it("throws NotFoundException when artist not found", async () => {
			mockArtistManagerService.findOne.mockResolvedValue(null);

			await expect(controller.getExternalUrls("missing")).rejects.toThrow(NotFoundException);
		});
	});

	describe("search", () => {
		it("searches artists using SearchSourcesService when source available", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			const raw = {
				artists: ["uuid1", "uuid2"],
				artistTotal: 2,
			};
			mockSearchSourcesService.search.mockResolvedValue(raw);
			const fetched = [
				{ uuid: "uuid1", toResponse: () => ({ uuid: "uuid1" }) },
				{ uuid: "uuid2", toResponse: () => ({ uuid: "uuid2" }) },
			];
			mockArtistManagerService.findManyRaw.mockResolvedValue(fetched);

			const dto = { pageSize: 10, page: 1, sort: "name" };

			const result = await controller.search(dto);

			expect(mockSearchSourcesService.search).toHaveBeenCalledWith({
				sort: dto.sort,
				entities: { artists: { limit: dto.pageSize, page: dto.page } },
			});
			expect(mockArtistManagerService.findManyRaw).toHaveBeenCalledWith({
				where: { uuid: expect.objectContaining({ value: ["uuid1", "uuid2"] }) },
				relationLoadStrategy: "query",
				relations: { attributes: true, identities: true },
			});
			expect(result.totalPages).toBe(1);
			expect(result.artists).toEqual([
				{ uuid: "uuid1" },
				{ uuid: "uuid2" },
			]);
		});

		it("searches artists using ArtistManagerService when no external source", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(false);
			const artists = [
				{ uuid: "a1", toResponse: () => ({ uuid: "a1" }) },
				{ uuid: "a2", toResponse: () => ({ uuid: "a2" }) },
			];
			mockArtistManagerService.findMany.mockResolvedValue(artists);

			const dto = { pageSize: 10, page: 2, sort: "name" };

			const result = await controller.search(dto);

			expect(mockArtistManagerService.findMany).toHaveBeenCalledWith({
				amount: dto.pageSize,
				offset: (dto.page - 1) * dto.pageSize,
				withAttributes: true,
				withIdentities: true,
			});
			expect(result.totalPages).toBeNull();
			expect(result.artists).toEqual([
				{ uuid: "a1" },
				{ uuid: "a2" },
			]);
		});

		it("skips findManyRaw and returns null totalPages when raw artists is empty and total is undefined", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			mockSearchSourcesService.search.mockResolvedValue({ artists: [], artistTotal: undefined });

			const result = await controller.search({ pageSize: 10, page: 1, sort: "name" });

			expect(mockArtistManagerService.findManyRaw).not.toHaveBeenCalled();
			expect(result.artists).toEqual([]);
			expect(result.totalPages).toBeNull();
		});

		it("filters out ordered uuids that were not fetched", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(true);
			mockSearchSourcesService.search.mockResolvedValue({
				artists: ["uuid1", "ghost"],
				artistTotal: 5,
			});
			mockArtistManagerService.findManyRaw.mockResolvedValue([
				{ uuid: "uuid1", toResponse: () => ({ uuid: "uuid1" }) },
			]);

			const result = await controller.search({ pageSize: 10, page: 1, sort: "name" });

			expect(result.artists).toEqual([{ uuid: "uuid1" }]);
			expect(result.totalPages).toBe(1);
		});
	});
});
