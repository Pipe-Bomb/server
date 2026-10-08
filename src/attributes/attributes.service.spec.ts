import { AttributesService } from "./attributes.service";

describe("AttributesService", () => {
	let service: AttributesService;
	let mockAttributeSourcesService: any;
	let mockTasksService: any;
	let mockArtistManagerService: any;
	let mockAlbumManagerService: any;

	const makeSource = (overrides: any = {}) => ({
		plugin: { package: { name: "plug" } },
		source: { id: "src", getName: () => "Source", ...overrides },
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockAttributeSourcesService = {
			getSources: jest.fn(),
			createTrackAttributes: jest.fn(),
			createArtistAttributes: jest.fn(),
			createAlbumAttributes: jest.fn(),
			upsertTrackAttributes: jest.fn(),
			upsertArtistAttributes: jest.fn(),
			replaceAllArtistAttributes: jest.fn(),
			replaceAllAlbumAttributes: jest.fn(),
		};
		mockTasksService = {
			registerSystemTask: jest.fn(),
		};
		mockArtistManagerService = {
			resolveArtist: jest.fn(),
			setJoinPhrase: jest.fn(),
			getInformationHelper: jest.fn(),
			count: jest.fn(),
			findManyRaw: jest.fn(),
			updateAttributionRunId: jest.fn(),
		};
		mockAlbumManagerService = {
			getInformationHelper: jest.fn(),
			resolveArtist: jest.fn(),
			setJoinPhrase: jest.fn(),
			count: jest.fn(),
			findManyRaw: jest.fn(),
			updateAttributionRunId: jest.fn(),
		};

		service = new AttributesService(
			mockAttributeSourcesService as any,
			mockTasksService as any,
			mockArtistManagerService as any,
			mockAlbumManagerService as any,
		);
	});

	describe("constructor", () => {
		it("registers the attribute-artists and attribute-albums system tasks", () => {
			expect(mockTasksService.registerSystemTask).toHaveBeenCalledTimes(2);
			expect(mockTasksService.registerSystemTask).toHaveBeenCalledWith(
				expect.objectContaining({ id: "attribute-artists" }),
			);
			expect(mockTasksService.registerSystemTask).toHaveBeenCalledWith(
				expect.objectContaining({ id: "attribute-albums" }),
			);
		});
	});

	describe("attributeTrack", () => {
		it("collects track and artist attributes from sources and upserts them", async () => {
			const source = makeSource({
				getTrackAttributeValues: jest.fn().mockResolvedValue({
					attributes: [{ key: "duration", value: 100 }],
					artists: [
						{
							pluginId: "plug",
							identityId: "artist-id",
							identity: "artist-val",
							attributes: [{ key: "country", value: "DE" }],
							joinPhrase: "feat.",
						},
					],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([source]);
			mockAttributeSourcesService.createTrackAttributes.mockResolvedValue([
				{ key: "duration" },
			]);
			mockAttributeSourcesService.createArtistAttributes.mockResolvedValue([
				{ key: "country" },
			]);
			mockArtistManagerService.resolveArtist.mockResolvedValue("artist-uuid");

			const track = { uuid: "track-uuid" } as any;
			const library = {
				informationHelper: jest.fn().mockResolvedValue({}),
			} as any;

			const result = await service.attributeTrack(track, library);

			expect(source.source.getTrackAttributeValues).toHaveBeenCalledWith(
				expect.objectContaining({
					getCompletedAttributeKeys: expect.any(Function),
				}),
			);
			expect(
				mockAttributeSourcesService.createTrackAttributes,
			).toHaveBeenCalledWith("track-uuid", [{ key: "duration", value: 100 }], source);
			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plug",
				"artist-id",
				"artist-val",
				expect.any(String),
			);
			expect(mockArtistManagerService.setJoinPhrase).toHaveBeenCalledWith(
				"track-uuid",
				"artist-uuid",
				"feat.",
			);
			expect(mockAttributeSourcesService.upsertTrackAttributes).toHaveBeenCalledWith([
				{ key: "duration" },
			]);
			expect(mockAttributeSourcesService.upsertArtistAttributes).toHaveBeenCalledWith([
				{ key: "country" },
			]);
			expect(result).toEqual([{ key: "duration" }]);
		});

		it("skips artists that cannot be resolved", async () => {
			const source = makeSource({
				getTrackAttributeValues: jest.fn().mockResolvedValue({
					attributes: [],
					artists: [
						{
							pluginId: "plug",
							identityId: "id",
							identity: "val",
							attributes: [{ key: "k", value: 1 }],
						},
					],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([source]);
			mockAttributeSourcesService.createTrackAttributes.mockResolvedValue([]);
			mockArtistManagerService.resolveArtist.mockResolvedValue(null);

			const track = { uuid: "track-uuid" } as any;
			const library = {
				informationHelper: jest.fn().mockResolvedValue({}),
			} as any;

			const result = await service.attributeTrack(track, library);

			expect(mockAttributeSourcesService.createArtistAttributes).not.toHaveBeenCalled();
			expect(mockAttributeSourcesService.upsertArtistAttributes).toHaveBeenCalledWith([]);
			expect(result).toEqual([]);
		});

		it("continues with the remaining sources when one fails", async () => {
			const failing = makeSource({
				getTrackAttributeValues: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const working = makeSource({
				id: "src2",
				getTrackAttributeValues: jest.fn().mockResolvedValue({
					attributes: [{ key: "k", value: "v" }],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([failing, working]);
			mockAttributeSourcesService.createTrackAttributes.mockResolvedValue([
				{ key: "k" },
			]);

			const track = { uuid: "track-uuid" } as any;
			const library = {
				informationHelper: jest.fn().mockResolvedValue({}),
			} as any;

			const result = await service.attributeTrack(track, library);

			expect(result).toEqual([{ key: "k" }]);
		});
	});

	describe("attributeArtist", () => {
		it("replaces artist attributes with values from all sources", async () => {
			const source = makeSource({
				getArtistAttributeValues: jest.fn().mockResolvedValue({
					attributes: [{ key: "country", value: "DE" }],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([source]);
			mockAttributeSourcesService.createArtistAttributes.mockResolvedValue([
				{ key: "country" },
			]);
			mockArtistManagerService.getInformationHelper.mockResolvedValue({});

			const artist = { uuid: "artist-uuid" } as any;

			await service.attributeArtist(artist);

			expect(source.source.getArtistAttributeValues).toHaveBeenCalledWith({});
			expect(
				mockAttributeSourcesService.createArtistAttributes,
			).toHaveBeenCalledWith("artist-uuid", [{ key: "country", value: "DE" }], source);
			expect(mockAttributeSourcesService.replaceAllArtistAttributes).toHaveBeenCalledWith(
				"artist-uuid",
				[{ key: "country" }],
			);
		});

		it("skips failing sources but still replaces attributes", async () => {
			const failing = makeSource({
				getArtistAttributeValues: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const working = makeSource({
				id: "src2",
				getArtistAttributeValues: jest.fn().mockResolvedValue({
					attributes: [{ key: "k", value: "v" }],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([failing, working]);
			mockAttributeSourcesService.createArtistAttributes.mockResolvedValue([
				{ key: "k" },
			]);
			mockArtistManagerService.getInformationHelper.mockResolvedValue({});

			const artist = { uuid: "artist-uuid" } as any;

			await service.attributeArtist(artist);

			expect(mockAttributeSourcesService.replaceAllArtistAttributes).toHaveBeenCalledWith(
				"artist-uuid",
				[{ key: "k" }],
			);
		});
	});

	describe("attributeAllArtists", () => {
		it("returns early when there are no artists to attribute", async () => {
			mockArtistManagerService.count.mockResolvedValue(0);

			await service.attributeAllArtists("runId", true, jest.fn());

			expect(mockArtistManagerService.count).toHaveBeenCalledTimes(1);
			expect(mockArtistManagerService.findManyRaw).not.toHaveBeenCalled();
		});

		it("attributes chunks of artists and records successful run ids", async () => {
			mockArtistManagerService.count.mockResolvedValue(2);
			mockArtistManagerService.findManyRaw
				.mockResolvedValueOnce([{ uuid: "a1" }, { uuid: "a2" }] as any)
				.mockResolvedValue([]);
			jest.spyOn(service, "attributeArtist").mockResolvedValue(undefined);
			const onProgress = jest.fn();

			await service.attributeAllArtists("runId", false, onProgress);

			expect(mockArtistManagerService.findManyRaw).toHaveBeenCalledWith({
				where: expect.any(Array),
				take: 100,
			});
			expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2);
			expect(mockArtistManagerService.updateAttributionRunId).toHaveBeenCalledWith(
				"runId",
				["a1", "a2"],
			);
		});

		it("excludes failed artists from the run id update", async () => {
			mockArtistManagerService.count.mockResolvedValue(2);
			mockArtistManagerService.findManyRaw
				.mockResolvedValueOnce([{ uuid: "a1" }, { uuid: "a2" }] as any)
				.mockResolvedValue([]);
			jest.spyOn(service, "attributeArtist").mockImplementation(async (artist: any) => {
				if (artist.uuid === "a2") {
					throw new Error("boom");
				}
			});

			await service.attributeAllArtists("runId", false);

			expect(mockArtistManagerService.updateAttributionRunId).toHaveBeenCalledWith(
				"runId",
				["a1"],
			);
		});
	});

	describe("attributeAllAlbums", () => {
		it("returns early when there are no albums to attribute", async () => {
			mockAlbumManagerService.count.mockResolvedValue(0);

			await service.attributeAllAlbums("runId", true, jest.fn());

			expect(mockAlbumManagerService.count).toHaveBeenCalledTimes(1);
			expect(mockAlbumManagerService.findManyRaw).not.toHaveBeenCalled();
		});

		it("attributes chunks of albums and records successful run ids", async () => {
			mockAlbumManagerService.count.mockResolvedValue(1);
			mockAlbumManagerService.findManyRaw
				.mockResolvedValueOnce([{ uuid: "al1" }] as any)
				.mockResolvedValue([]);
			jest.spyOn(service, "attributeAlbum").mockResolvedValue([]);

			await service.attributeAllAlbums("runId", false);

			expect(mockAlbumManagerService.updateAttributionRunId).toHaveBeenCalledWith(
				"runId",
				["al1"],
			);
		});
	});

	describe("attributeAlbum", () => {
		it("replaces album attributes and upserts artist attributes", async () => {
			const source = makeSource({
				getAlbumAttributeValues: jest.fn().mockResolvedValue({
					attributes: [{ key: "release-group", value: "Album" }],
					artists: [
						{
							pluginId: "plug",
							identityId: "aid",
							identity: "aval",
							attributes: [{ key: "role", value: "performer" }],
							joinPhrase: "performed by",
						},
					],
				}),
			});
			mockAttributeSourcesService.getSources.mockReturnValue([source]);
			mockAttributeSourcesService.createAlbumAttributes.mockResolvedValue([
				{ key: "release-group" },
			]);
			mockAttributeSourcesService.createArtistAttributes.mockResolvedValue([
				{ key: "role" },
			]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({});
			mockArtistManagerService.resolveArtist.mockResolvedValue("artist-uuid");

			const album = { uuid: "album-uuid" } as any;

			const result = await service.attributeAlbum(album);

			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plug",
				"aid",
				"aval",
				expect.any(String),
			);
			expect(mockAlbumManagerService.setJoinPhrase).toHaveBeenCalledWith(
				"album-uuid",
				"artist-uuid",
				"performed by",
			);
			expect(mockAttributeSourcesService.replaceAllAlbumAttributes).toHaveBeenCalledWith(
				"album-uuid",
				[{ key: "release-group" }],
			);
			expect(mockAttributeSourcesService.upsertArtistAttributes).toHaveBeenCalledWith([
				{ key: "role" },
			]);
			expect(result).toEqual([{ key: "release-group" }]);
		});
	});
});
