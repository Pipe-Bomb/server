import { EphemeralService } from "./ephemeral.service";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";

const makePlugin = (name = "plug-a") =>
	({
		package: { name },
		plugin: {},
		directoryPath: `/plugins/${name}`,
		updateStatus: "ok",
	}) as any;

const makeSource = (id = "src-1", overrides: Record<string, unknown> = {}) => {
	const source: any = {
		id,
		enable: jest.fn(),
		getLibraryHandler: jest.fn().mockReturnValue({ id: "lib-1" }),
		search: jest.fn().mockResolvedValue({ tracks: [] }),
		resolveTracks: jest.fn().mockResolvedValue([]),
		resolveArtist: jest.fn().mockResolvedValue(null),
		resolveAlbum: jest.fn().mockResolvedValue(null),
		resolveArtistContent: jest.fn().mockResolvedValue(null),
		resolveAlbumContent: jest.fn().mockResolvedValue(null),
		...overrides,
	};
	return source;
};

const makeLoadedAttributeSource = (
	pluginId = "plug-a",
	sourceId = "attr-1",
) =>
	({
		source: { id: sourceId },
		plugin: { package: { name: pluginId } },
	}) as any;

const makeLoadedAttribute = (key: string, type: string, supportsMultiple = false) =>
	({ attribute: { key, type, supportsMultiple } }) as any;

describe("EphemeralService", () => {
	let service: EphemeralService;
	let attributeSourcesService: any;
	let artistManagerService: any;
	let trackManagerService: any;
	let identifiersService: any;

	beforeEach(() => {
		attributeSourcesService = {
			getSources: jest.fn().mockReturnValue([]),
			getAlbumAttributes: jest.fn().mockReturnValue([]),
			getArtistAttributes: jest.fn().mockReturnValue([]),
			getTrackAttributes: jest.fn().mockReturnValue([]),
			doSourcesMatch: jest.fn().mockReturnValue(true),
			getFormatter: jest.fn().mockReturnValue(() => "fmt"),
			createArtistAttributes: jest.fn().mockResolvedValue([]),
			upsertArtistAttributes: jest.fn().mockResolvedValue(undefined),
			createTrackAttributes: jest.fn().mockResolvedValue([]),
			upsertTrackAttributes: jest.fn().mockResolvedValue(undefined),
		};
		artistManagerService = {
			resolveArtist: jest.fn().mockResolvedValue("artist-uuid"),
			setTrackLinks: jest.fn().mockResolvedValue(undefined),
		};
		trackManagerService = {
			addTracks: jest.fn().mockResolvedValue([]),
		};
		identifiersService = {
			all: jest.fn().mockReturnValue([]),
			identifyTrackWithIdentity: jest.fn().mockResolvedValue(undefined),
		};

		service = new EphemeralService(
			attributeSourcesService,
			artistManagerService,
			trackManagerService,
			identifiersService,
		);
	});

	const registerAndCapture = (source: any, plugin = makePlugin()) => {
		let cfg: any;
		source.enable = jest.fn((c: any) => {
			cfg = c;
		});
		service.registerEphemeralSource(source, plugin);
		return cfg;
	};

	const attachAttr = (cfg: any, rawAttrId = "attr-1") => {
		const rawAttr = { id: rawAttrId };
		attributeSourcesService.getSources.mockReturnValue([
			{ source: rawAttr, plugin: { package: { name: "plug-a" } } },
		]);
		cfg.useAttributeSource(rawAttr);
		return rawAttr;
	};

	const mockTrackIdentifier = (identifierId = "ident-1", pluginName = "plug-a") => {
		identifiersService.all.mockReturnValue([
			{
				plugin: { package: { name: pluginName } },
				identifier: { id: identifierId, target: "track" },
			},
		]);
	};

	describe("registration", () => {
		it("registers a source and finds it by id", () => {
			service.registerEphemeralSource(makeSource("src-1"), makePlugin());
			expect(service.find("plug-a", "src-1")).not.toBeNull();
			expect(service.allFlat()).toHaveLength(1);
		});

		it("throws on a duplicate source id", () => {
			service.registerEphemeralSource(makeSource("src-1"), makePlugin());
			expect(() =>
				service.registerEphemeralSource(makeSource("src-1"), makePlugin()),
			).toThrow(/already registered/);
		});

		it("unregisters a source", () => {
			const source = makeSource("src-1");
			service.registerEphemeralSource(source, makePlugin());
			service.unregisterEphemeralSource(source, makePlugin());
			expect(service.find("plug-a", "src-1")).toBeNull();
		});

		it("is a no-op when unregistering an unknown source", () => {
			expect(() =>
				service.unregisterEphemeralSource(makeSource("nope"), makePlugin()),
			).not.toThrow();
		});
	});

	describe("getSourcesUsingHandler", () => {
		it("returns sources that use the given handler", () => {
			const handler = { id: "lib-1" };
			const source = makeSource("src-1", {
				getLibraryHandler: jest.fn().mockReturnValue(handler),
			});
			service.registerEphemeralSource(source, makePlugin());
			expect(service.getSourcesUsingHandler(handler)).toEqual([
				"EphemeralSource:plug-a:src-1",
			]);
		});

		it("returns empty when no source matches", () => {
			expect(service.getSourcesUsingHandler({ id: "other" })).toEqual([]);
		});
	});

	describe("search", () => {
		it("attaches the attribute source to the results", async () => {
			const source = makeSource("src-1", {
				search: jest.fn().mockResolvedValue({ tracks: ["t1"] }),
			});
			const loaded = { source, plugin: makePlugin() } as any;
			await expect(
				service.search(loaded, {} as any),
			).resolves.toEqual({ tracks: ["t1"], attributeSource: null });
		});

		it("rethrows when the source search fails", async () => {
			const source = makeSource("src-1", {
				search: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const loaded = { source, plugin: makePlugin() } as any;
			await expect(service.search(loaded, {} as any)).rejects.toThrow("boom");
		});
	});

	describe("resolveArtists", () => {
		it("resolves an artist uuid per metadata entry", async () => {
			const metas = [
				{ pluginId: "p", identityId: "id", identity: "value" },
			];
			await expect(
				service.resolveArtists(metas as any),
			).resolves.toEqual(["artist-uuid"]);
			expect(artistManagerService.resolveArtist).toHaveBeenCalledWith(
				"p",
				"id",
				"value",
				ArtistIdentityTarget.TRACK,
				false,
			);
		});

		it("returns null for a metadata entry that fails to resolve", async () => {
			artistManagerService.resolveArtist.mockRejectedValue(new Error("nope"));
			await expect(
				service.resolveArtists([
					{ pluginId: "p", identityId: "id", identity: "v" },
				] as any),
			).resolves.toEqual([null]);
		});
	});

	describe("identifier claims", () => {
		it("tracks which source claimed an artist identifier", () => {
			let enableConfig: any;
			const source = makeSource("src-1", {
				enable: jest.fn((cfg) => {
					enableConfig = cfg;
				}),
			});
			service.registerEphemeralSource(source, makePlugin());
			enableConfig.resolveArtistIdentifier("ident-1");

			expect(
				service.getEphemeralSourceByArtistIdentity("plug-a", "ident-1"),
			).not.toBeNull();
			expect(
				service.getArtistIdentifiers(service.find("plug-a", "src-1")!),
			).toEqual(["ident-1"]);
		});

		it("returns null for an unclaimed identity", () => {
			expect(
				service.getEphemeralSourceByAlbumIdentity("plug-a", "missing"),
			).toBeNull();
		});
	});

	describe("toTrackResponse", () => {
		it("maps an ephemeral track to a response", () => {
			const source = makeSource("src-1");
			const loaded = { source, plugin: makePlugin() } as any;
			const track = { id: "t1", title: "Song" } as any;

			expect(service.toTrackResponse(track, loaded, null, null)).toEqual({
				trackId: "t1",
				title: "Song",
				pluginId: "plug-a",
				libraryId: "lib-1",
				attributes: null,
				artists: null,
			});
		});
	});

	describe("toArtistResponse", () => {
		it("maps an ephemeral artist to a response", () => {
			const artist = {
				pluginId: "p",
				identityId: "id",
				identity: "value",
			} as any;

			expect(service.toArtistResponse(artist, null, null, null)).toEqual({
				uuid: null,
				attributes: null,
				albums: null,
				tracks: null,
				identities: [
					{ pluginId: "p", identityId: "id", value: "value", ordinal: 0 },
				],
			});
		});
	});

	describe("createEphemeralAttributes", () => {
		it("builds a string attribute response", () => {
			const result = service.createEphemeralAttributes(
				[{ key: "name", value: "Bob" }] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("name", "string")],
				"artist",
			);

			expect(result.name.type).toBe("string");
			expect(result.name.values).toEqual(["Bob"]);
			expect(result.name.pluginId).toBe("plug-a");
			expect(result.name.sourceId).toBe("attr-1");
		});

		it("throws for an unregistered attribute key", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "missing", value: "x" }] as any,
					makeLoadedAttributeSource(),
					[],
					"artist",
				),
			).toThrow(/has not registered an Attribute/);
		});

		it("rejects a value that does not match the type", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "count", value: "not-a-number" }] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("count", "integer")],
					"artist",
				),
			).toThrow(/is type integer/);
		});
	});

	describe("createTracks", () => {
		it("resolves created tracks in the requested order", async () => {
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([{ id: "t1", title: "Song" }]),
			});
			service.registerEphemeralSource(source, makePlugin());

			const dbTrack = {
				trackId: "t1",
				pluginId: "plug-a",
				libraryId: "lib-1",
				uuid: "u1",
			} as any;
			trackManagerService.addTracks.mockResolvedValue([dbTrack]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" } as any,
			]);

			const output = await session.promise;
			expect(output).toEqual([dbTrack]);
		});
	});

	describe("creation session responses", () => {
		it("maps a session to a response with a percentage", () => {
			const session = {
				uuid: "s1",
				started: 1000,
				percent: 0.5,
				playlistUuids: [],
			} as any;

			expect(service.toCreationSessionResponse(session)).toEqual({
				uuid: "s1",
				dateStarted: new Date(1000),
				percent: 50,
			});
		});

		it("returns a null percent for a session that has not progressed", () => {
			const session = {
				uuid: "s1",
				started: 1000,
				percent: null,
				playlistUuids: [],
			} as any;
			expect(service.toCreationSessionResponse(session).percent).toBeNull();
		});

		it("filters creation sessions by playlist", () => {
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([]),
			});
			service.registerEphemeralSource(source, makePlugin());

			service.createTracks([], { playlistUuids: ["pl-1"] });

			const sessions = service.getCreationSessionsByPlaylistUuid("pl-1");
			expect(sessions).toHaveLength(1);
			expect(sessions[0].playlistUuids).toEqual(["pl-1"]);
			expect(
				service.getCreationSessionsByPlaylistUuid("other"),
			).toHaveLength(0);
		});
	});

	describe("registerEphemeralSource enable callbacks", () => {
		it("throws when selecting an already-selected attribute source", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			const rawAttr = { id: "a" };
			attributeSourcesService.getSources.mockReturnValue([
				{ source: rawAttr, plugin: { package: { name: "plug-a" } } },
			]);
			cfg.useAttributeSource(rawAttr);
			expect(() => cfg.useAttributeSource(rawAttr)).toThrow(
				/already selected/,
			);
		});

		it("throws when the attribute source is not loaded", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			attributeSourcesService.getSources.mockReturnValue([]);
			expect(() => cfg.useAttributeSource({ id: "missing" })).toThrow(
				/not loaded/,
			);
		});

		it("throws when an artist identifier is already resolved", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			expect(() => cfg.resolveArtistIdentifier("a1")).toThrow(
				/already being resolved/,
			);
		});

		it("throws when an album identifier is already resolved", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al1");
			expect(() => cfg.resolveAlbumIdentifier("al1")).toThrow(
				/already being resolved/,
			);
		});

		it("throws when a track identifier is not loaded", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			identifiersService.all.mockReturnValue([]);
			expect(() => cfg.useTrackIdentifier("t1")).toThrow(/not loaded/);
		});

		it("throws when a track identifier target is not a track", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			identifiersService.all.mockReturnValue([
				{
					plugin: { package: { name: "plug-a" } },
					identifier: { id: "t1", target: "artist" },
				},
			]);
			expect(() => cfg.useTrackIdentifier("t1")).toThrow(
				/not of Target "track"/,
			);
		});

		it("throws when a track identifier is already resolved", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			mockTrackIdentifier("t1");
			cfg.useTrackIdentifier("t1");
			expect(() => cfg.useTrackIdentifier("t1")).toThrow(
				/already being resolved/,
			);
		});
	});

	describe("removeAttributeSource", () => {
		it("removes the attribute source association", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			const rawAttr = attachAttr(cfg);
			expect(service.getAttributeSource(source)).not.toBeNull();
			service.removeAttributeSource(rawAttr);
			expect(service.getAttributeSource(source)).toBeNull();
		});
	});

	describe("removeIdentifierClaims", () => {
		it("removes all identifier claims for a plugin", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			cfg.resolveAlbumIdentifier("al1");
			mockTrackIdentifier("t1");
			cfg.useTrackIdentifier("t1");

			expect(
				service.getEphemeralSourceByArtistIdentity("plug-a", "a1"),
			).not.toBeNull();
			expect(
				service.getEphemeralSourceByAlbumIdentity("plug-a", "al1"),
			).not.toBeNull();

			service.removeIdentifierClaims("plug-a", "a1");
			service.removeIdentifierClaims("plug-a", "al1");
			service.removeIdentifierClaims("plug-a", "t1");

			expect(
				service.getEphemeralSourceByArtistIdentity("plug-a", "a1"),
			).toBeNull();
			expect(
				service.getEphemeralSourceByAlbumIdentity("plug-a", "al1"),
			).toBeNull();
		});
	});

	describe("identifier listing", () => {
		it("lists album identifiers for a source", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al-1");
			cfg.resolveAlbumIdentifier("al-2");
			expect(
				service.getAlbumIdentifiers(service.find("plug-a", "src-1")!),
			).toEqual(["al-1", "al-2"]);
		});

		it("returns null for an unclaimed album identity", () => {
			expect(
				service.getEphemeralSourceByAlbumIdentity("plug-a", "missing"),
			).toBeNull();
		});
	});

	describe("getAttributeSource", () => {
		it("returns the attached attribute source or null", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			expect(service.getAttributeSource(source)).toBeNull();
			attachAttr(cfg);
			expect(service.getAttributeSource(source)).not.toBeNull();
		});
	});

	describe("getEphemeralArtistContent", () => {
		it("returns null when content is null", async () => {
			const source = makeSource("src-1", {
				resolveArtistContent: jest.fn().mockResolvedValue(null),
			});
			service.registerEphemeralSource(source, makePlugin());
			const loaded = service.find("plug-a", "src-1")!;
			await expect(
				service.getEphemeralArtistContent(loaded, "id", "v"),
			).resolves.toBeNull();
		});

		it("rethrows when resolving artist content fails", async () => {
			const source = makeSource("src-1", {
				resolveArtistContent: jest.fn().mockRejectedValue(new Error("boom")),
			});
			service.registerEphemeralSource(source, makePlugin());
			const loaded = service.find("plug-a", "src-1")!;
			await expect(
				service.getEphemeralArtistContent(loaded, "id", "v"),
			).rejects.toThrow("boom");
		});

		it("resolves tracks and albums with an attribute source", async () => {
			const source = makeSource("src-1", {
				resolveArtistContent: jest.fn().mockResolvedValue({
					tracks: [
						{
							id: "t1",
							title: "Song",
							artists: [
								{ pluginId: "p", identityId: "iid", identity: "artist" },
							],
						},
					],
					albums: [
						{
							pluginId: "p",
							identityId: "aid",
							identity: "album",
							artists: [
								{ pluginId: "p", identityId: "iid2", identity: "artist2" },
							],
							attributes: [],
						},
					],
				}),
			});
			const cfg = registerAndCapture(source);
			attachAttr(cfg);
			attributeSourcesService.getTrackAttributes.mockReturnValue([]);
			attributeSourcesService.getAlbumAttributes.mockReturnValue([]);
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const loaded = service.find("plug-a", "src-1")!;
			const result = await service.getEphemeralArtistContent(loaded, "id", "v");
			expect(result.source).toBe(loaded);
			expect(result.tracks).toHaveLength(1);
			expect(result.albums).toHaveLength(1);
		});
	});

	describe("getEphemeralAlbumContent", () => {
		it("returns null when content is null", async () => {
			const source = makeSource("src-1", {
				resolveAlbumContent: jest.fn().mockResolvedValue(null),
			});
			service.registerEphemeralSource(source, makePlugin());
			const loaded = service.find("plug-a", "src-1")!;
			await expect(
				service.getEphemeralAlbumContent(loaded, "id", "v"),
			).resolves.toBeNull();
		});

		it("resolves tracks with an attribute source", async () => {
			const source = makeSource("src-1", {
				resolveAlbumContent: jest
					.fn()
					.mockResolvedValue({
						tracks: [
							{
								id: "t1",
								title: "S",
								artists: [
									{ pluginId: "p", identityId: "iid", identity: "artist" },
								],
							},
						],
					}),
			});
			const cfg = registerAndCapture(source);
			attachAttr(cfg);
			attributeSourcesService.getTrackAttributes.mockReturnValue([]);
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const loaded = service.find("plug-a", "src-1")!;
			const result = await service.getEphemeralAlbumContent(loaded, "id", "v");
			expect(result.source).toBe(loaded);
			expect(result.tracks).toHaveLength(1);
		});
	});

	describe("getEphemeralArtistSources", () => {
		it("returns the unique sources behind the given identities", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			cfg.resolveArtistIdentifier("a2");
			const identities = [
				{ pluginId: "plug-a", identifierId: "a1" },
				{ pluginId: "plug-a", identifierId: "a2" },
				{ pluginId: "plug-a", identifierId: "missing" },
			];
			expect(service.getEphemeralArtistSources(identities as any)).toEqual([
				service.find("plug-a", "src-1"),
			]);
		});

		it("returns empty when no identity matches", () => {
			expect(
				service.getEphemeralArtistSources([
					{ pluginId: "plug-a", identifierId: "missing" },
				] as any),
			).toEqual([]);
		});
	});

	describe("getEphemeralAlbumSources", () => {
		it("returns the unique sources behind the given identities", () => {
			const source = makeSource("src-1");
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al1");
			const identities = [
				{ pluginId: "plug-a", identifierId: "al1" },
				{ pluginId: "plug-a", identifierId: "missing" },
			];
			expect(service.getEphemeralAlbumSources(identities as any)).toEqual([
				service.find("plug-a", "src-1"),
			]);
		});
	});

	describe("resolveEphemeralAlbum", () => {
		it("returns null when no source claims the identity", async () => {
			await expect(
				service.resolveEphemeralAlbum("plug-a", "id", "v"),
			).resolves.toBeNull();
		});

		it("returns null when the source resolves nothing", async () => {
			const source = makeSource("src-1", {
				resolveAlbum: jest.fn().mockResolvedValue(null),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al1");
			await expect(
				service.resolveEphemeralAlbum("plug-a", "al1", "v"),
			).resolves.toBeNull();
		});

		it("rethrows when resolving fails", async () => {
			const source = makeSource("src-1", {
				resolveAlbum: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al1");
			await expect(
				service.resolveEphemeralAlbum("plug-a", "al1", "v"),
			).rejects.toThrow("boom");
		});

		it("resolves an album with artists and an attribute source", async () => {
			const source = makeSource("src-1", {
				resolveAlbum: jest.fn().mockResolvedValue({
					artists: [
						{
							pluginId: "p",
							identityId: "iid",
							identity: "artist",
							joinPhrase: "feat.",
						},
					],
					attributes: [],
				}),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveAlbumIdentifier("al1");
			attachAttr(cfg);
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			attributeSourcesService.getAlbumAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const result = await service.resolveEphemeralAlbum("plug-a", "al1", "v");
			expect(result.uuid).toBeNull();
			expect(result.artists).toHaveLength(1);
			expect(result.artists[0].joinPhrase).toBe("feat.");
			expect(result.attributes).toEqual({});
			expect(result.identities).toEqual([
				{ pluginId: "plug-a", identityId: "al1", value: "v", ordinal: 0 },
			]);
		});
	});

	describe("resolveEphemeralArtist", () => {
		it("returns null when no source claims the identity", async () => {
			await expect(
				service.resolveEphemeralArtist("plug-a", "id", "v"),
			).resolves.toBeNull();
		});

		it("returns null when the source resolves nothing", async () => {
			const source = makeSource("src-1", {
				resolveArtist: jest.fn().mockResolvedValue(null),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			await expect(
				service.resolveEphemeralArtist("plug-a", "a1", "v"),
			).resolves.toBeNull();
		});

		it("rethrows when resolving fails", async () => {
			const source = makeSource("src-1", {
				resolveArtist: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			await expect(
				service.resolveEphemeralArtist("plug-a", "a1", "v"),
			).rejects.toThrow("boom");
		});

		it("resolves an artist with attributes", async () => {
			const source = makeSource("src-1", {
				resolveArtist: jest.fn().mockResolvedValue({
					attributes: [{ key: "name", value: "Bob" }],
				}),
			});
			const cfg = registerAndCapture(source);
			cfg.resolveArtistIdentifier("a1");
			attachAttr(cfg);
			attributeSourcesService.getArtistAttributes.mockReturnValue([
				makeLoadedAttribute("name", "string"),
			]);

			const result = await service.resolveEphemeralArtist("plug-a", "a1", "v");
			expect(result.uuid).toBeNull();
			expect(result.attributes.name.values).toEqual(["Bob"]);
			expect(result.identities).toEqual([
				{ pluginId: "plug-a", identityId: "a1", value: "v", ordinal: 0 },
			]);
		});
	});

	describe("toAlbumsResponse", () => {
		it("maps albums without an attribute source", async () => {
			const albums = [
				{
					pluginId: "p",
					identityId: "aid",
					identity: "album",
					artists: [
						{
							pluginId: "p",
							identityId: "iid",
							identity: "artist",
							joinPhrase: "&",
						},
					],
					attributes: [],
				},
			];
			const result = await service.toAlbumsResponse(albums as any, null);
			expect(result).toHaveLength(1);
			expect(result[0].uuid).toBeNull();
			expect(result[0].artists).toBeNull();
			expect(result[0].attributes).toBeNull();
		});

		it("maps albums with an attribute source", async () => {
			const albums = [
				{
					pluginId: "p",
					identityId: "aid",
					identity: "album",
					artists: [
						{ pluginId: "p", identityId: "iid", identity: "artist" },
					],
					attributes: [],
				},
			];
			const attrSource = makeLoadedAttributeSource();
			attributeSourcesService.getAlbumAttributes.mockReturnValue([]);
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const result = await service.toAlbumsResponse(albums as any, attrSource);
			expect(result[0].artists[0].artistUuid).toBe("u1");
			expect(result[0].attributes).toEqual({});
		});
	});

	describe("toAlbumResponse", () => {
		it("maps an album to a response", () => {
			const album = { pluginId: "p", identityId: "aid", identity: "album" };
			expect(service.toAlbumResponse(album as any, null, null)).toEqual({
				uuid: null,
				artists: null,
				attributes: null,
				tracks: null,
				identities: [
					{ pluginId: "p", identityId: "aid", value: "album", ordinal: 0 },
				],
			});
		});
	});

	describe("toTracksResponse", () => {
		it("maps tracks without an attribute source", async () => {
			const source = makeSource("src-1");
			const loaded = { source, plugin: makePlugin() } as any;
			const result = await service.toTracksResponse(
				[{ id: "t1", title: "S" }] as any,
				loaded,
				null,
			);
			expect(result).toHaveLength(1);
			expect(result[0].trackId).toBe("t1");
		});

		it("maps tracks with artists and an attribute source", async () => {
			const source = makeSource("src-1");
			const loaded = { source, plugin: makePlugin() } as any;
			const attrSource = makeLoadedAttributeSource();
			attributeSourcesService.getTrackAttributes.mockReturnValue([]);
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const result = await service.toTracksResponse(
				[
					{
						id: "t1",
						title: "S",
						artists: [
							{ pluginId: "p", identityId: "iid", identity: "artist" },
						],
					},
				] as any,
				loaded,
				attrSource,
			);
			expect(result[0].artists[0].artistUuid).toBe("u1");
		});
	});

	describe("toArtistsResponse", () => {
		it("maps artists without an attribute source", async () => {
			const result = await service.toArtistsResponse(
				[
					{ pluginId: "p", identityId: "iid", identity: "artist" },
				] as any,
				null,
			);
			expect(result).toHaveLength(1);
			expect(result[0].uuid).toBeNull();
		});

		it("maps artists with an attribute source", async () => {
			const attrSource = makeLoadedAttributeSource();
			attributeSourcesService.getArtistAttributes.mockReturnValue([]);
			artistManagerService.resolveArtist.mockResolvedValue("u1");

			const result = await service.toArtistsResponse(
				[
					{ pluginId: "p", identityId: "iid", identity: "artist" },
				] as any,
				attrSource,
			);
			expect(result[0].uuid).toBe("u1");
		});
	});

	describe("createEphemeralAttributes", () => {
		it("builds a boolean attribute", () => {
			const result = service.createEphemeralAttributes(
				[{ key: "flag", value: true }] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("flag", "boolean")],
				"track",
			);
			expect(result.flag.values).toEqual([true]);
			expect(result.flag.type).toBe("boolean");
		});

		it("builds a decimal attribute", () => {
			const result = service.createEphemeralAttributes(
				[{ key: "d", value: 1.5 }] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("d", "decimal")],
				"track",
			);
			expect(result.d.values).toEqual([1.5]);
		});

		it("rejects Infinity for a decimal attribute", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "d", value: Infinity }] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("d", "decimal")],
					"track",
				),
			).toThrow(/doesn't support Infinity/);
		});

		it("builds an integer attribute", () => {
			const result = service.createEphemeralAttributes(
				[{ key: "i", value: 5 }] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("i", "integer")],
				"track",
			);
			expect(result.i.values).toEqual([5]);
		});

		it("rejects a non-integer for an integer attribute", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "i", value: 1.5 }] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("i", "integer")],
					"track",
				),
			).toThrow(/is type integer/);
		});

		it("rejects a non-boolean for a boolean attribute", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "flag", value: "yes" }] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("flag", "boolean")],
					"track",
				),
			).toThrow(/is type boolean/);
		});

		it("throws when a multi-value attribute receives multiple values", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[
						{ key: "tags", value: "a" },
						{ key: "tags", value: "b" },
					] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("tags", "string", true)],
					"track",
				),
			).toThrow(/expects only one/);
		});

		it("appends values for a single-value attribute that receives multiple values", () => {
			const result = service.createEphemeralAttributes(
				[
					{ key: "name", value: "a" },
					{ key: "name", value: "b" },
				] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("name", "string", false)],
				"track",
			);
			expect(result.name.values).toEqual(["a", "b"]);
		});

		it("builds a buffer attribute and proxies it", () => {
			const bufferValue = { buffer: Buffer.from("abc"), extension: "png" };
			const result = service.createEphemeralAttributes(
				[{ key: "cover", value: bufferValue }] as any,
				makeLoadedAttributeSource(),
				[makeLoadedAttribute("cover", "buffer")],
				"track",
			);
			const uuid = result.cover.values[0].uuid;
			expect(uuid).toBeTruthy();
			expect(result.cover.type).toBe("buffer");
			expect(result.cover.formatted).toBeNull();
			expect(service.getProxiedAttribute(uuid)).toBe(bufferValue);
		});

		it("rejects a value that is not a valid buffer", () => {
			expect(() =>
				service.createEphemeralAttributes(
					[{ key: "cover", value: "not-a-buffer" }] as any,
					makeLoadedAttributeSource(),
					[makeLoadedAttribute("cover", "buffer")],
					"track",
				),
			).toThrow(/is type buffer/);
		});
	});

	describe("getProxiedAttribute", () => {
		it("returns null for an unknown proxied buffer", () => {
			expect(service.getProxiedAttribute("nope")).toBeNull();
		});
	});

	describe("createTracks", () => {
		it("links artists and identifies the track", async () => {
			mockTrackIdentifier("ident-1");
			const trackArtist = {
				pluginId: "p",
				identityId: "iid",
				identity: "artist",
			};
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([
					{
						id: "t1",
						title: "Song",
						identityId: "ident-1",
						identity: "idval",
						artists: [trackArtist],
					},
				]),
			});
			const cfg = registerAndCapture(source);
			cfg.useTrackIdentifier("ident-1");
			attachAttr(cfg);

			const dbTrack = {
				trackId: "t1",
				pluginId: "plug-a",
				libraryId: "lib-1",
				uuid: "u1",
			};
			trackManagerService.addTracks.mockResolvedValue([dbTrack]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(artistManagerService.resolveArtist).toHaveBeenCalled();
			expect(artistManagerService.setTrackLinks).toHaveBeenCalled();
			expect(identifiersService.identifyTrackWithIdentity).toHaveBeenCalled();
			expect(output).toEqual([dbTrack]);
		});

		it("creates artist attributes when an artist has attributes", async () => {
			const trackArtist = {
				pluginId: "p",
				identityId: "iid",
				identity: "artist",
				attributes: [{ key: "name", value: "Bob" }],
			};
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([
					{ id: "t1", title: "Song", artists: [trackArtist] },
				]),
			});
			const cfg = registerAndCapture(source);
			attachAttr(cfg);

			const dbTrack = {
				trackId: "t1",
				pluginId: "plug-a",
				libraryId: "lib-1",
				uuid: "u1",
			};
			trackManagerService.addTracks.mockResolvedValue([dbTrack]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(
				attributeSourcesService.createArtistAttributes,
			).toHaveBeenCalled();
			expect(
				attributeSourcesService.upsertArtistAttributes,
			).toHaveBeenCalled();
			expect(output).toEqual([dbTrack]);
		});

		it("creates track attributes when the track has an identity and attributes", async () => {
			mockTrackIdentifier("ident-1");
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([
					{
						id: "t1",
						title: "Song",
						identityId: "ident-1",
						identity: "idval",
						attributes: [{ key: "d", value: 1 }],
					},
				]),
			});
			const cfg = registerAndCapture(source);
			cfg.useTrackIdentifier("ident-1");
			attachAttr(cfg);

			const dbTrack = {
				trackId: "t1",
				pluginId: "plug-a",
				libraryId: "lib-1",
				uuid: "u1",
			};
			trackManagerService.addTracks.mockResolvedValue([dbTrack]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(
				attributeSourcesService.createTrackAttributes,
			).toHaveBeenCalled();
			expect(
				attributeSourcesService.upsertTrackAttributes,
			).toHaveBeenCalled();
			expect(output).toEqual([dbTrack]);
		});

		it("skips a track that uses an identity it has not registered", async () => {
			const claimant = makeSource("other-lib");
			mockTrackIdentifier("ident-1", "plug-b");
			const cfgB = registerAndCapture(claimant, makePlugin("plug-b"));
			cfgB.useTrackIdentifier("ident-1");

			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([
					{ id: "t1", title: "Song", identityId: "ident-1", identity: "idval" },
				]),
			});
			service.registerEphemeralSource(source, makePlugin());

			const dbTrack = {
				trackId: "t1",
				pluginId: "plug-a",
				libraryId: "lib-1",
				uuid: "u1",
			};
			trackManagerService.addTracks.mockResolvedValue([dbTrack]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(identifiersService.identifyTrackWithIdentity).not.toHaveBeenCalled();
			expect(output).toEqual([]);
		});

		it("skips a track that was not returned by the database", async () => {
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockResolvedValue([
					{ id: "t1", title: "Song" },
				]),
			});
			service.registerEphemeralSource(source, makePlugin());
			trackManagerService.addTracks.mockResolvedValue([]);

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(output).toEqual([]);
		});

		it("continues when resolveTracks fails for a source", async () => {
			const source = makeSource("lib-1", {
				resolveTracks: jest.fn().mockRejectedValue(new Error("boom")),
			});
			service.registerEphemeralSource(source, makePlugin());

			const session = await service.createTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" },
			]);
			const output = await session.promise;

			expect(output).toEqual([]);
		});
	});
});
