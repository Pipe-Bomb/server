import { AttributeSourcesService } from "./attribute-sources.service";

describe("AttributeSourcesService", () => {
	let service: AttributeSourcesService;
	let mockTrackAttributesRepository: any;
	let mockArtistAttributesRepository: any;
	let mockAlbumAttributesRepository: any;
	let mockPlaylistAttributesRepository: any;
	let mockTasksService: any;
	let mockResourcesService: any;

	const makePlugin = (name: string) => ({ package: { name } });

	const makeSource = (id: string) => {
		const source: any = {
			id,
			enable: jest.fn(),
			getName: () => id,
		};
		return source;
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockTrackAttributesRepository = {
			create: jest.fn(),
			upsert: jest.fn(),
		};
		mockArtistAttributesRepository = {
			create: jest.fn(),
			delete: jest.fn(),
			insert: jest.fn(),
			upsert: jest.fn(),
		};
		mockAlbumAttributesRepository = {
			create: jest.fn(),
			delete: jest.fn(),
			insert: jest.fn(),
		};
		mockPlaylistAttributesRepository = {
			create: jest.fn(),
			delete: jest.fn(),
			insert: jest.fn(),
		};
		mockTasksService = {
			registerPluginTask: jest.fn(),
		};
		mockResourcesService = {
			create: jest.fn(),
		};

		service = new AttributeSourcesService(
			mockTrackAttributesRepository as any,
			mockArtistAttributesRepository as any,
			mockAlbumAttributesRepository as any,
			mockPlaylistAttributesRepository as any,
			mockTasksService as any,
			mockResourcesService as any,
		);
	});

	describe("registerAttributeSource", () => {
		it("enables the source and registers its attributes", () => {
			const source = makeSource("src");
			source.enable.mockImplementation((helper: any) => {
				helper.registerTrackAttributes([
					{ key: "duration", type: "integer", supportsMultiple: false },
				]);
				helper.registerPluginTask({ id: "task" });
			});
			const plugin = makePlugin("plug");

			service.registerAttributeSource(plugin as any, source);

			expect(source.enable).toHaveBeenCalledTimes(1);
			expect(service.getSources()).toHaveLength(1);
			expect(service.getTrackAttributes()).toEqual([
				expect.objectContaining({
					attribute: expect.objectContaining({ key: "duration" }),
				}),
			]);
			expect(mockTasksService.registerPluginTask).toHaveBeenCalledWith(
				{ id: "task" },
				plugin,
			);
		});

		it("throws when the plugin already registered a source with the same id", () => {
			service.registerAttributeSource(makePlugin("plug") as any, makeSource("src"));

			expect(() =>
				service.registerAttributeSource(
					makePlugin("plug") as any,
					makeSource("src"),
				),
			).toThrow(/already registered/);
		});
	});

	describe("unregisterAttributeSource", () => {
		it("removes the source and its attributes", () => {
			const source = makeSource("src");
			source.enable.mockImplementation((helper: any) => {
				helper.registerTrackAttributes([
					{ key: "duration", type: "integer", supportsMultiple: false },
				]);
			});
			service.registerAttributeSource(makePlugin("plug") as any, source);

			service.unregisterAttributeSource(makePlugin("plug") as any, source);

			expect(service.getSources()).toHaveLength(0);
			expect(service.getTrackAttributes()).toHaveLength(0);
		});

		it("is a no-op for an unknown source", () => {
			service.unregisterAttributeSource(makePlugin("plug") as any, makeSource("src"));

			expect(service.getSources()).toHaveLength(0);
		});

		it("removes artist, album, and playlist attributes as well", () => {
			const source = makeSource("src");
			source.enable.mockImplementation((helper: any) => {
				helper.registerArtistAttributes([
					{ key: "a", type: "string", supportsMultiple: false },
				]);
				helper.registerAlbumAttributes([
					{ key: "b", type: "string", supportsMultiple: false },
				]);
				helper.registerPlaylistAttributes([
					{ key: "c", type: "string", supportsMultiple: false },
				]);
			});
			service.registerAttributeSource(makePlugin("plug") as any, source);

			expect(service.getArtistAttributes()).toHaveLength(1);
			expect(service.getAlbumAttributes()).toHaveLength(1);
			expect(service.getPlaylistAttributes()).toHaveLength(1);

			service.unregisterAttributeSource(makePlugin("plug") as any, source);

			expect(service.getArtistAttributes()).toHaveLength(0);
			expect(service.getAlbumAttributes()).toHaveLength(0);
			expect(service.getPlaylistAttributes()).toHaveLength(0);
		});
	});

	describe("getAttributeSource", () => {
		it("returns the loaded source or null", () => {
			service.registerAttributeSource(makePlugin("plug") as any, makeSource("src"));

			expect(service.getAttributeSource("plug", "src")).not.toBeNull();
			expect(service.getAttributeSource("plug", "other")).toBeNull();
		});
	});

	describe("doSourcesMatch", () => {
		it("treats two null sources as a match", () => {
			expect(service.doSourcesMatch(null, null)).toBe(true);
		});

		it("compares plugin and source ids", () => {
			service.registerAttributeSource(makePlugin("p1") as any, makeSource("a"));
			service.registerAttributeSource(makePlugin("p1") as any, makeSource("b"));
			service.registerAttributeSource(makePlugin("p2") as any, makeSource("a"));

			const loaded1 = service.getAttributeSource("p1", "a")!;
			const loaded2 = service.getAttributeSource("p2", "a")!;

			expect(service.doSourcesMatch(loaded1, loaded1)).toBe(true);
			expect(service.doSourcesMatch(loaded1, loaded2)).toBe(false);
		});

		it("returns false when only one source is null", () => {
			service.registerAttributeSource(makePlugin("p1") as any, makeSource("a"));
			const loaded = service.getAttributeSource("p1", "a")!;

			expect(service.doSourcesMatch(loaded, null)).toBe(false);
			expect(service.doSourcesMatch(null, loaded)).toBe(false);
		});
	});

	describe("registerTrackAttribute", () => {
		it("registers a custom attribute with a null source", () => {
			service.registerTrackAttribute(
				null,
				{ key: "custom", type: "string", supportsMultiple: false } as any,
			);

			expect(service.getTrackAttributes()).toHaveLength(1);
		});

		it("throws on duplicate custom attribute keys", () => {
			service.registerTrackAttribute(
				null,
				{ key: "custom", type: "string", supportsMultiple: false } as any,
			);

			expect(() =>
				service.registerTrackAttribute(
					null,
					{ key: "custom", type: "string", supportsMultiple: false } as any,
				),
			).toThrow(/Custom "track" Attribute has already been registered/);
		});

		it("throws on duplicate source attribute keys", () => {
			service.registerAttributeSource(makePlugin("plug") as any, makeSource("src"));
			const loaded = service.getAttributeSource("plug", "src");

			service.registerTrackAttribute(
				loaded,
				{ key: "k", type: "string", supportsMultiple: false } as any,
			);

			expect(() =>
				service.registerTrackAttribute(
					loaded,
					{ key: "k", type: "string", supportsMultiple: false } as any,
				),
			).toThrow(/has already registered a "track" Attribute/);
		});
	});

	describe("createTrackAttributes", () => {
		const makeCreate = () =>
			mockTrackAttributesRepository.create.mockImplementation((data: any) => ({
				...data,
				ordinal: 0,
			}));

		it("creates entities with typed values", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "title", type: "string", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "title", value: "Hello" }],
				null,
			);

			expect(mockTrackAttributesRepository.create).toHaveBeenCalledWith({
				entityId: "track-uuid",
				entityRelationId: "track-uuid",
				pluginId: "",
				sourceId: "",
				key: "title",
			});
			expect(result).toHaveLength(1);
			expect(result[0].value_string).toBe("Hello");
			expect(result[0].ordinal).toBe(0);
		});

		it("increments the ordinal for repeated keys", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "genre", type: "string", supportsMultiple: true } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[
					{ key: "genre", value: "Rock" },
					{ key: "genre", value: "Pop" },
				],
				null,
			);

			expect(result.map((a: any) => a.ordinal)).toEqual([0, 1]);
		});

		it("skips attributes with a mismatched type", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "title", type: "string", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "title", value: 42 as any }],
				null,
			);

			expect(result).toEqual([]);
		});

		it("stores buffer attributes through the resources service", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "cover", type: "buffer", supportsMultiple: false } as any,
			);
			mockResourcesService.create.mockResolvedValue({ resourceUuid: "res" });

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "cover", value: { buffer: Buffer.from("png"), extension: "png" } }],
				null,
			);

			expect(mockResourcesService.create).toHaveBeenCalledWith(
				Buffer.from("png"),
				"png",
			);
			expect(result).toHaveLength(1);
		});

		it("stamps the plugin and source ids when a source is provided", async () => {
			makeCreate();
			const plugin = makePlugin("plug");
			const source = makeSource("src");
			source.enable.mockImplementation((helper: any) => {
				helper.registerTrackAttributes([
					{ key: "duration", type: "integer", supportsMultiple: false },
				]);
			});
			service.registerAttributeSource(plugin as any, source);
			const loaded = service.getAttributeSource("plug", "src")!;

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "duration", value: 90 }],
				loaded,
			);

			expect(mockTrackAttributesRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					pluginId: "plug",
					sourceId: "src",
				}),
			);
			expect(result[0].value_int).toBe(90);
		});

		it("throws for unregistered custom attribute keys", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "known", type: "string", supportsMultiple: false } as any,
			);

			await expect(
				service.createTrackAttributes(
					"track-uuid",
					[{ key: "unknown", value: 1 }],
					null,
				),
			).rejects.toThrow(
				/Custom Attribute has not been registered with key "unknown"/,
			);
		});

		it("skips boolean attributes with a non-boolean value", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "flag", type: "boolean", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "flag", value: "yes" as any }],
				null,
			);

			expect(result).toEqual([]);
		});

		it("stores boolean attributes with a boolean value", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "flag", type: "boolean", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "flag", value: true }],
				null,
			);

			expect(result[0].value_boolean).toBe(true);
		});

		it("skips integer attributes with a fractional value", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "year", type: "integer", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "year", value: 2000.5 }],
				null,
			);

			expect(result).toEqual([]);
		});

		it("skips decimal attributes with an Infinity value", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "rating", type: "decimal", supportsMultiple: false } as any,
			);

			const result = await service.createTrackAttributes(
				"track-uuid",
				[{ key: "rating", value: Infinity }],
				null,
			);

			expect(result).toEqual([]);
		});

		it("resolves function buffers before storing the resource", async () => {
			makeCreate();
			service.registerTrackAttribute(
				null,
				{ key: "cover", type: "buffer", supportsMultiple: false } as any,
			);
			mockResourcesService.create.mockResolvedValue({ resourceUuid: "res" });

			const result = await service.createTrackAttributes(
				"track-uuid",
				[
					{
						key: "cover",
						value: {
							buffer: () => Promise.resolve(Buffer.from("lazy")),
							extension: "jpg",
						},
					},
				],
				null,
			);

			expect(mockResourcesService.create).toHaveBeenCalledWith(
				Buffer.from("lazy"),
				"jpg",
			);
			expect(result).toHaveLength(1);
		});
	});

	describe("customToAttributeValues", () => {
		it("wraps buffer values and passes plain values through", () => {
			const result = service.customToAttributeValues([
				{ key: "text", type: "string", value: "hi" } as any,
				{
					key: "cover",
					type: "buffer",
					value: Buffer.from("png"),
					extension: "png",
				} as any,
			]);

			expect(result).toEqual([
				{ key: "text", value: "hi" },
				{
					key: "cover",
					value: { buffer: Buffer.from("png"), extension: "png" },
				},
			]);
		});
	});

	describe("entity attribute creation", () => {
		const makeCreate = (repository: any) =>
			repository.create.mockImplementation((data: any) => ({
				...data,
				ordinal: 0,
			}));

		it("creates artist attributes through the artist repository", async () => {
			makeCreate(mockArtistAttributesRepository);
			service.registerArtistAttribute(
				null,
				{ key: "name", type: "string", supportsMultiple: false } as any,
			);

			const result = await service.createArtistAttributes(
				"artist-uuid",
				[{ key: "name", value: "Ada" }],
				null,
			);

			expect(mockArtistAttributesRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ entityId: "artist-uuid", key: "name" }),
			);
			expect(result[0].value_string).toBe("Ada");
		});

		it("creates album attributes through the album repository", async () => {
			makeCreate(mockAlbumAttributesRepository);
			service.registerAlbumAttribute(
				null,
				{ key: "title", type: "string", supportsMultiple: false } as any,
			);

			const result = await service.createAlbumAttributes(
				"album-uuid",
				[{ key: "title", value: "Opus" }],
				null,
			);

			expect(mockAlbumAttributesRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ entityId: "album-uuid", key: "title" }),
			);
			expect(result[0].value_string).toBe("Opus");
		});

		it("creates playlist attributes through the playlist repository", async () => {
			makeCreate(mockPlaylistAttributesRepository);
			service.registerPlaylistAttribute(
				null,
				{ key: "note", type: "string", supportsMultiple: false } as any,
			);

			const result = await service.createPlaylistAttributes(
				"playlist-uuid",
				[{ key: "note", value: "vibes" }],
				null,
			);

			expect(mockPlaylistAttributesRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					entityId: "playlist-uuid",
					key: "note",
				}),
			);
			expect(result[0].value_string).toBe("vibes");
		});
	});

	describe("attribute persistence", () => {
		it("replaces all artist attributes", async () => {
			await service.replaceAllArtistAttributes("artist-uuid", [
				{ key: "a" },
			] as any);

			expect(mockArtistAttributesRepository.delete).toHaveBeenCalledWith({
				entityId: "artist-uuid",
			});
			expect(mockArtistAttributesRepository.insert).toHaveBeenCalledWith([
				{ key: "a" },
			]);
		});

		it("upserts track attributes with the full conflict path", async () => {
			await service.upsertTrackAttributes([{ key: "a" }] as any);

			expect(mockTrackAttributesRepository.upsert).toHaveBeenCalledWith(
				[{ key: "a" }],
				{
					conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
				},
			);
		});

		it("replaces all album attributes", async () => {
			await service.replaceAllAlbumAttributes("album-uuid", [
				{ key: "b" },
			] as any);

			expect(mockAlbumAttributesRepository.delete).toHaveBeenCalledWith({
				entityId: "album-uuid",
			});
			expect(mockAlbumAttributesRepository.insert).toHaveBeenCalledWith([
				{ key: "b" },
			]);
		});

		it("upserts artist attributes with the full conflict path", async () => {
			await service.upsertArtistAttributes([{ key: "a" }] as any);

			expect(mockArtistAttributesRepository.upsert).toHaveBeenCalledWith(
				[{ key: "a" }],
				{
					conflictPaths: ["pluginId", "entityId", "sourceId", "ordinal", "key"],
				},
			);
		});

		it("deletes by In(keys) with empty ids and re-inserts playlist attributes", async () => {
			await service.upsertPlaylistAttributes(
				"playlist-uuid",
				null,
				[
					{ key: "a" },
					{ key: "b" },
				] as any,
			);

			const deleteWhere = mockPlaylistAttributesRepository.delete.mock
				.calls[0][0];
			expect(deleteWhere.entityId).toBe("playlist-uuid");
			expect(deleteWhere.pluginId).toBe("");
			expect(deleteWhere.sourceId).toBe("");
			expect(deleteWhere.key._type).toBe("in");
			expect(deleteWhere.key._value).toEqual(["a", "b"]);
			expect(mockPlaylistAttributesRepository.insert).toHaveBeenCalledWith([
				{ key: "a" },
				{ key: "b" },
			]);
		});
	});

	describe("setSourceOrder", () => {
		it("reorders sources and keeps unlisted ones at the end", () => {
			service.registerAttributeSource(makePlugin("p") as any, makeSource("s1"));
			service.registerAttributeSource(makePlugin("p") as any, makeSource("s2"));
			service.registerAttributeSource(makePlugin("p") as any, makeSource("s3"));

			service.setSourceOrder([
				{ pluginId: "p", sourceId: "s3" },
				{ pluginId: "p", sourceId: "s1" },
			]);

			expect(service.getSources().map((s) => s.source.id)).toEqual([
				"s3",
				"s1",
				"s2",
			]);
		});
	});

	describe("getFormatter", () => {
		it("uses the registered formatter for a key and type", () => {
			service.registerTrackAttribute(
				null,
				{
					key: "year",
					type: "integer",
					supportsMultiple: false,
					formatter: (value: any) => `year:${value}`,
				} as any,
			);

			const format = service.getFormatter("track");

			expect(format("plug", "src", "year", "integer", 2000)).toBe("year:2000");
		});

		it("falls back to toString for unformatted values", () => {
			const format = service.getFormatter("track");

			expect(format("plug", "src", "year", "integer", 2000)).toBe("2000");
		});

		it("keeps the formatter of the earlier-registered source", () => {
			const sourceA = makeSource("a");
			sourceA.enable.mockImplementation((helper: any) => {
				helper.registerTrackAttributes([
					{
						key: "k",
						type: "integer",
						supportsMultiple: false,
						formatter: () => "from-a",
					},
				]);
			});
			const sourceB = makeSource("b");
			sourceB.enable.mockImplementation((helper: any) => {
				helper.registerTrackAttributes([
					{
						key: "k",
						type: "integer",
						supportsMultiple: false,
						formatter: () => "from-b",
					},
				]);
			});
			service.registerAttributeSource(makePlugin("p1") as any, sourceA);
			service.registerAttributeSource(makePlugin("p2") as any, sourceB);

			const format = service.getFormatter("track");

			expect(format("p1", "a", "k", "integer", 1)).toBe("from-a");
		});

		it("ignores formatters for buffer attributes", () => {
			service.registerTrackAttribute(
				null,
				{
					key: "cover",
					type: "buffer",
					supportsMultiple: false,
					formatter: () => "buffered",
				} as any,
			);

			const format = service.getFormatter("track");

			expect(format("plug", "src", "cover", "buffer", "x")).toBe("x");
		});
	});

	describe("toMap", () => {
		it("returns null for null attributes", () => {
			expect(service.toMap(null, "track")).toBeNull();
		});

		it("merges custom attributes into a single response", () => {
			const makeResponse = (values: any[]) => () => ({
				key: "k",
				type: "string",
				values,
				pluginId: "",
				sourceId: "",
			});
			const attributes = [
				{ key: "k", pluginId: "", sourceId: "", toResponse: makeResponse(["a"]) },
				{ key: "k", pluginId: "", sourceId: "", toResponse: makeResponse(["b"]) },
			] as any;

			const result = service.toMap(attributes, "track");

			expect(result.k.values).toEqual(["a", "b"]);
		});

		it("merges source attributes and computes formatted values", () => {
			service.registerAttributeSource(makePlugin("plug") as any, makeSource("src"));
			const makeResponse = (values: any[]) => () => ({
				key: "k",
				type: "string",
				values,
				pluginId: "plug",
				sourceId: "src",
			});
			const attributes = [
				{
					key: "k",
					pluginId: "plug",
					sourceId: "src",
					toResponse: makeResponse(["a"]),
				},
				{
					key: "k",
					pluginId: "plug",
					sourceId: "src",
					toResponse: makeResponse(["b"]),
				},
			] as any;

			const result = service.toMap(attributes, "track");

			expect(result.k.values).toEqual(["a", "b"]);
			expect(result.k.formatted).toEqual(["a", "b"]);
		});

		it("skips attributes whose source is not loaded", () => {
			const makeResponse = (values: any[]) => () => ({
				key: "k",
				type: "string",
				values,
				pluginId: "ghost",
				sourceId: "src",
			});
			const attributes = [
				{
					key: "k",
					pluginId: "ghost",
					sourceId: "src",
					toResponse: makeResponse(["a"]),
				},
			] as any;

			const result = service.toMap(attributes, "track");

			expect(result).toEqual({});
		});

		it("leaves buffer responses unformatted", () => {
			service.registerAttributeSource(makePlugin("plug") as any, makeSource("src"));
			const attributes = [
				{
					key: "cover",
					pluginId: "plug",
					sourceId: "src",
					toResponse: () => ({
						key: "cover",
						type: "buffer",
						values: ["res-1"],
						pluginId: "plug",
						sourceId: "src",
					}),
				},
			] as any;

			const result = service.toMap(attributes, "track");

			expect(result.cover.formatted).toBeNull();
		});
	});
});
