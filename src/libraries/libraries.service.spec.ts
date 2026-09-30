jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

import { LibrariesService } from "./libraries.service";

const makePlugin = (name = "plug-a") =>
	({
		package: { name },
		plugin: {},
		directoryPath: `/plugins/${name}`,
		updateStatus: "ok",
	}) as any;

const makeHandler = (id = "lib-1") =>
	({
		id,
		enable: jest.fn(),
		scan: jest.fn(),
		doTracksExist: jest.fn().mockResolvedValue([]),
	}) as any;

const makeLibrary = (pluginId = "plug-a", libraryId = "lib-1") =>
	({
		handler: { id: libraryId },
		plugin: makePlugin(pluginId),
		informationHelper: jest.fn(),
	}) as any;

describe("LibrariesService", () => {
	let service: LibrariesService;
	let trackManager: any;
	let attributesService: any;
	let tasksService: any;
	let identifiersService: any;
	let audioCacheService: any;

	beforeEach(() => {
		trackManager = {
			count: jest.fn(),
			find: jest.fn(),
			removeTracks: jest.fn(),
			addTrack: jest.fn(),
			setRunId: jest.fn().mockResolvedValue(undefined),
			queryBuilder: jest.fn(),
			deleteAll: jest.fn().mockResolvedValue(undefined),
		};
		attributesService = {
			attributeTrack: jest.fn().mockResolvedValue([]),
			registerAttributeSource: jest.fn(),
		};
		tasksService = {
			registerSystemTask: jest.fn(),
			registerPluginTask: jest.fn(),
		};
		identifiersService = {
			getTrackIdentity: jest.fn().mockResolvedValue([]),
			getDisabledSet: jest.fn().mockResolvedValue(new Set()),
			identifyTrack: jest.fn().mockResolvedValue(undefined),
		};
		audioCacheService = {
			getAudioProducer: jest.fn(),
			cacheTrack: jest.fn().mockResolvedValue(true),
		};

		service = new LibrariesService(
			trackManager,
			attributesService,
			tasksService,
			identifiersService,
			audioCacheService,
		);
	});

	it("registers four system tasks on construction", () => {
		expect(tasksService.registerSystemTask).toHaveBeenCalledTimes(4);
		const ids = tasksService.registerSystemTask.mock.calls.map((c) => c[0].id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"scan-all-libraries",
				"identify-tracks",
				"attribute-tracks",
				"cache-all-libraries",
			]),
		);
	});

	describe("findLibrary", () => {
		it("returns a library by string plugin id", () => {
			service.register(makeHandler(), makePlugin("plug-a"));
			expect(service.findLibrary("plug-a", "lib-1")).not.toBeNull();
		});

		it("returns a library by LoadedPlugin object", () => {
			const plugin = makePlugin("plug-a");
			service.register(makeHandler(), plugin);
			expect(service.findLibrary(plugin, "lib-1")).not.toBeNull();
		});

		it("returns null for unknown plugin", () => {
			expect(service.findLibrary("missing", "lib-1")).toBeNull();
		});

		it("returns null for unknown library id", () => {
			service.register(makeHandler(), makePlugin("plug-a"));
			expect(service.findLibrary("plug-a", "missing")).toBeNull();
		});
	});

	describe("all / allFlat", () => {
		it("returns empty when nothing registered", () => {
			expect(service.all()).toEqual([]);
			expect(service.allFlat()).toEqual([]);
		});

		it("flattens libraries across plugins", () => {
			service.register(makeHandler("lib-1"), makePlugin("plug-a"));
			service.register(makeHandler("lib-2"), makePlugin("plug-a"));
			service.register(makeHandler("lib-3"), makePlugin("plug-b"));
			expect(service.all()).toHaveLength(2);
			expect(service.allFlat()).toHaveLength(3);
		});
	});

	describe("getCount", () => {
		it("delegates to track manager count with library scope", async () => {
			trackManager.count.mockResolvedValue(7);
			await expect(
				service.getCount(makeLibrary("plug-a", "lib-1")),
			).resolves.toBe(7);
			expect(trackManager.count).toHaveBeenCalledWith({
				libraryId: "lib-1",
				pluginId: "plug-a",
			});
		});
	});

	describe("findTracks", () => {
		it("delegates to track manager find and wraps result", async () => {
			const tracks = [{ trackId: "t1", uuid: "u1" }];
			trackManager.find.mockResolvedValue(tracks);
			const result = await service.findTracks(makeLibrary(), {
				amount: 10,
			});
			expect(result).toEqual({ tracks });
			expect(trackManager.find).toHaveBeenCalledWith(
				expect.objectContaining({ take: 10 }),
			);
		});

		it("applies title sort order", async () => {
			trackManager.find.mockResolvedValue([]);
			await service.findTracks(makeLibrary(), {
				amount: 5,
				sort: { key: "title", direction: "desc" },
			});
			expect(trackManager.find).toHaveBeenCalledWith(
				expect.objectContaining({ order: { title: "DESC" } }),
			);
		});
	});

	describe("getTrackUuids", () => {
		it("maps found tracks to their uuids", async () => {
			trackManager.find.mockResolvedValue([
				{ uuid: "u1" },
				{ uuid: "u2" },
			]);
			await expect(
				service.getTrackUuids(makeLibrary()),
			).resolves.toEqual(["u1", "u2"]);
		});
	});

	describe("forEachTrackId", () => {
		it("invokes the callback for each track", async () => {
			trackManager.find
				.mockResolvedValueOnce([
					{ trackId: "t1", uuid: "u1" },
					{ trackId: "t2", uuid: "u2" },
				])
				.mockResolvedValue([]);
			const seen: string[] = [];
			await service.forEachTrackId(makeLibrary(), (trackId) => {
				seen.push(trackId);
			});
			expect(seen).toEqual(["t1", "t2"]);
		});

		it("stops when cancel is called", async () => {
			trackManager.find
				.mockResolvedValueOnce([
					{ trackId: "t1", uuid: "u1" },
					{ trackId: "t2", uuid: "u2" },
				])
				.mockResolvedValue([]);
			const seen: string[] = [];
			await service.forEachTrackId(makeLibrary(), (trackId, _uuid, cancel) => {
				seen.push(trackId);
				cancel();
			});
			expect(seen).toEqual(["t1"]);
		});
	});

	describe("register / unregister", () => {
		it("stores a library and enables the handler", () => {
			const handler = makeHandler();
			service.register(handler, makePlugin("plug-a"));
			expect(service.allFlat()).toHaveLength(1);
			expect(handler.enable).toHaveBeenCalled();
		});

		it("throws when registering a duplicate library id", () => {
			service.register(makeHandler("lib-1"), makePlugin("plug-a"));
			expect(() =>
				service.register(makeHandler("lib-1"), makePlugin("plug-a")),
			).toThrow(/already registered Library/);
		});

		it("removes a library and prunes empty plugins", () => {
			const plugin = makePlugin("plug-a");
			const handler = makeHandler("lib-1");
			service.register(handler, plugin);
			service.unregister(handler, plugin);
			expect(service.allFlat()).toHaveLength(0);
		});

		it("is a no-op for an unknown library", () => {
			expect(() =>
				service.unregister(makeHandler("nope"), makePlugin("plug-a")),
			).not.toThrow();
		});
	});

	describe("attribute", () => {
		it("resolves immediately when there is nothing to attribute", async () => {
			trackManager.count.mockResolvedValue(0);
			await service.attribute(makeLibrary(), "run-1", false);
			expect(attributesService.attributeTrack).not.toHaveBeenCalled();
			expect(trackManager.setRunId).not.toHaveBeenCalled();
		});

		it("attributes tracks and stamps the run id", async () => {
			trackManager.count.mockResolvedValue(1);
			const track = { uuid: "u1", trackId: "t1" };
			trackManager.find
				.mockResolvedValueOnce([track])
				.mockResolvedValue([]);
			await service.attribute(makeLibrary(), "run-1", false);
			expect(attributesService.attributeTrack).toHaveBeenCalledWith(
				track,
				expect.anything(),
			);
			expect(trackManager.setRunId).toHaveBeenCalledWith(
				[track],
				"run-1",
				"attribute",
			);
		});
	});

	describe("identify", () => {
		it("does nothing when count is zero", async () => {
			trackManager.count.mockResolvedValue(0);
			await service.identify(makeLibrary(), "run-1", false);
			expect(identifiersService.identifyTrack).not.toHaveBeenCalled();
		});

		it("identifies tracks and stamps the run id", async () => {
			trackManager.count.mockResolvedValue(1);
			const track = { uuid: "u1", trackId: "t1" };
			trackManager.find.mockResolvedValue([track]);
			await service.identify(makeLibrary(), "run-1", false);
			expect(identifiersService.identifyTrack).toHaveBeenCalledWith(
				track,
				expect.anything(),
				expect.any(Set),
			);
			expect(trackManager.setRunId).toHaveBeenCalledWith(
				[track],
				"run-1",
				"identity",
			);
		});
	});

	describe("cache", () => {
		it("resolves immediately when there is nothing to cache", async () => {
			trackManager.count.mockResolvedValue(0);
			await service.cache(makeLibrary());
			expect(audioCacheService.cacheTrack).not.toHaveBeenCalled();
		});

		it("caches tracks in the library", async () => {
			trackManager.count.mockResolvedValue(1);
			const track = { uuid: "u1", trackId: "t1" };
			trackManager.find
				.mockResolvedValueOnce([track])
				.mockResolvedValue([]);
			await service.cache(makeLibrary());
			expect(audioCacheService.cacheTrack).toHaveBeenCalledWith(
				expect.anything(),
				track,
			);
		});
	});

	describe("resolveTracks", () => {
		it("throws for an unknown plugin", async () => {
			await expect(
				service.resolveTracks([
					{ pluginId: "missing", libraryId: "l", trackId: "t" } as any,
				]),
			).rejects.toThrow("Plugin doesn't exist");
		});

		it("resolves matching tracks and nulls for missing ones", async () => {
			service.register(makeHandler("lib-1"), makePlugin("plug-a"));
			const found = {
				pluginId: "plug-a",
				libraryId: "lib-1",
				trackId: "t1",
				uuid: "u1",
			};
			trackManager.find.mockResolvedValue([found]);

			const output = await service.resolveTracks([
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t1" } as any,
				{ pluginId: "plug-a", libraryId: "lib-1", trackId: "t2" } as any,
			]);

			expect(output).toEqual([found, null]);
		});
	});

	describe("clearStaleLibraries", () => {
		it("deletes all tracks when nothing is registered", async () => {
			await service.clearStaleLibraries();
			expect(trackManager.deleteAll).toHaveBeenCalled();
		});

		it("deletes stale rows via the query builder", async () => {
			const qb = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			trackManager.queryBuilder.mockReturnValue(qb);
			service.register(makeHandler("lib-1"), makePlugin("plug-a"));

			await service.clearStaleLibraries();

			expect(trackManager.queryBuilder).toHaveBeenCalled();
			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining("pluginId"),
				expect.objectContaining({ p_0: "plug-a" }),
			);
			expect(qb.execute).toHaveBeenCalled();
		});
	});
});
