import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AlbumManagerService } from "./album-manager.service";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { DBAlbumIdentity } from "src/albums/entity/album-identity.entity";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { DeregistrationBlockedError } from "src/util/deregistration-blocked.error";

const createMockRepo = () => ({
	find: jest.fn(),
	findOne: jest.fn(),
	findBy: jest.fn(),
	insert: jest.fn(),
	update: jest.fn(),
	delete: jest.fn(),
	countBy: jest.fn(),
	create: jest.fn(),
	createQueryBuilder: jest.fn(),
});

const makePlugin = (name: string) =>
	({
		package: { name },
		plugin: {},
		directoryPath: `/plugins/${name}`,
		updateStatus: "ok",
	}) as any;

const makeIdentifier = (
	id: string,
	deps: { pluginId: string | null; sourceId: string }[] = [],
) =>
	({
		id,
		getDependencies: () => deps,
		getSoftDependencies: () => [],
	}) as any;

describe("AlbumManagerService", () => {
	let service: AlbumManagerService;
	let albumsRepo: ReturnType<typeof createMockRepo>;
	let albumArtistsRepo: ReturnType<typeof createMockRepo>;
	let identitiesRepo: ReturnType<typeof createMockRepo>;
	let albumTracksRepo: ReturnType<typeof createMockRepo>;
	let mockDataSource: { transaction: jest.Mock };
	let mockExternalUrlsService: { getAlbumUrls: jest.Mock };

	beforeEach(async () => {
		albumsRepo = createMockRepo();
		albumArtistsRepo = createMockRepo();
		identitiesRepo = createMockRepo();
		albumTracksRepo = createMockRepo();
		mockDataSource = { transaction: jest.fn() };
		mockExternalUrlsService = { getAlbumUrls: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AlbumManagerService,
				{
					provide: getRepositoryToken(DBAlbum),
					useValue: albumsRepo,
				},
				{
					provide: getRepositoryToken(DBAlbumArtist),
					useValue: albumArtistsRepo,
				},
				{
					provide: getRepositoryToken(DBAlbumIdentity),
					useValue: identitiesRepo,
				},
				{
					provide: getRepositoryToken(DBAlbumTrack),
					useValue: albumTracksRepo,
				},
				{ provide: DataSource, useValue: mockDataSource },
				{
					provide: ExternalUrlsService,
					useValue: mockExternalUrlsService,
				},
			],
		}).compile();

		service = module.get(AlbumManagerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("queryBuilder", () => {
		it("delegates to albumsRepository", () => {
			const qb = { select: jest.fn() };
			albumsRepo.createQueryBuilder.mockReturnValue(qb);
			expect(service.queryBuilder("a")).toBe(qb);
			expect(albumsRepo.createQueryBuilder).toHaveBeenCalledWith("a");
		});
	});

	describe("count", () => {
		it("delegates to countBy", async () => {
			albumsRepo.countBy.mockResolvedValue(5);
			await expect(service.count({ title: "x" } as any)).resolves.toBe(5);
			expect(albumsRepo.countBy).toHaveBeenCalledWith({ title: "x" });
		});
	});

	describe("findMany", () => {
		it("passes relations through", async () => {
			albumsRepo.find.mockResolvedValue([{ uuid: "a1" }]);
			const result = await service.findMany({
				amount: 10,
				offset: 20,
				withAttributes: true,
				withIdentities: true,
				withArtists: true,
				where: { title: "t" } as any,
			});
			expect(albumsRepo.find).toHaveBeenCalledWith({
				where: { title: "t" },
				take: 10,
				skip: 20,
				relationLoadStrategy: "query",
				select: undefined,
				relations: {
					attributes: true,
					identities: true,
					artists: {
						artist: {
							attributes: true,
						},
					},
				},
			});
			expect(result).toEqual([{ uuid: "a1" }]);
		});

		it("omits artists relation when withArtists is false", async () => {
			albumsRepo.find.mockResolvedValue([]);
			await service.findMany({ amount: 5 });
			const call = albumsRepo.find.mock.calls[0][0];
			expect(call.relations.artists).toBe(false);
		});
	});

	describe("findManyRaw", () => {
		it("passes options directly to find", async () => {
			albumsRepo.find.mockResolvedValue([{ uuid: "x" }]);
			const opts = { take: 3 } as any;
			await expect(service.findManyRaw(opts)).resolves.toEqual([
				{ uuid: "x" },
			]);
			expect(albumsRepo.find).toHaveBeenCalledWith(opts);
		});
	});

	describe("updateAttributionRunId", () => {
		it("updates with In() condition", async () => {
			await service.updateAttributionRunId("run1", ["a1", "a2"]);
			expect(albumsRepo.update).toHaveBeenCalledWith(
				{ uuid: In(["a1", "a2"]) },
				{ lastAttributionRunId: "run1" },
			);
		});
	});

	describe("findForArtist", () => {
		it("deduplicates by albumUuid", async () => {
			albumsRepo.find.mockResolvedValue([{ uuid: "a1" }, { uuid: "a2" }]);
			albumArtistsRepo.find.mockResolvedValue([
				{ albumUuid: "a1", artistUuid: "ar1" },
				{ albumUuid: "a1", artistUuid: "ar2" },
				{ albumUuid: "a2", artistUuid: "ar1" },
			]);

			const result = await service.findForArtist(
				{ uuid: "ar1" } as any,
				{},
			);

			expect(result).toHaveLength(2);
			expect(result[0].albumUuid).toBe("a1");
			expect(result[1].albumUuid).toBe("a2");
		});

		it("queries albums by artist relation", async () => {
			albumsRepo.find.mockResolvedValue([]);
			albumArtistsRepo.find.mockResolvedValue([]);

			await service.findForArtist({ uuid: "ar1" } as any, {});

			expect(albumsRepo.find).toHaveBeenCalledWith({
				where: { artists: { artistUuid: "ar1" } },
				select: ["uuid"],
			});
		});
	});

	describe("findOne", () => {
		it("returns album with requested relations", async () => {
			albumsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			const result = await service.findOne("a1", {
				withAttributes: true,
				withTracks: true,
			});
			expect(result).toEqual({ uuid: "a1" });
			expect(albumsRepo.findOne).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { uuid: "a1" },
				}),
			);
		});

		it("returns null when not found", async () => {
			albumsRepo.findOne.mockResolvedValue(null);
			await expect(service.findOne("missing", {})).resolves.toBeNull();
		});
	});

	describe("setRunId", () => {
		it("updates the identification run id", async () => {
			await service.setRunId({ uuid: "a1" } as any, "run9", "identity");
			expect(albumsRepo.update).toHaveBeenCalledWith(
				{ uuid: "a1" },
				{ lastIdentificationRunId: "run9" },
			);
		});
	});

	describe("resolveAlbum", () => {
		it("returns existing albumUuid when identity found", async () => {
			identitiesRepo.findOne.mockResolvedValue({ albumUuid: "existing" });
			const result = await service.resolveAlbum(
				"p1",
				"id1",
				"identity-val",
			);
			expect(result).toBe("existing");
			expect(identitiesRepo.findOne).toHaveBeenCalledWith({
				where: { pluginId: "p1", identifierId: "id1", identity: "identity-val" },
				select: ["albumUuid"],
			});
		});

		it("returns null when not found and createIfMissing is false", async () => {
			identitiesRepo.findOne.mockResolvedValue(null);
			const result = await service.resolveAlbum("p1", "id1", "identity-val");
			expect(result).toBeNull();
		});

		it("creates album in transaction when createIfMissing is true", async () => {
			identitiesRepo.findOne.mockResolvedValue(null);

			const savedAlbum = { uuid: "new-album" };
			const albRepo = {
				create: jest.fn().mockReturnValue({ title: "Unknown Album" }),
				save: jest.fn().mockResolvedValue(savedAlbum),
			};
			const idRepo = { insert: jest.fn().mockResolvedValue(undefined) };

			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = {
					getRepository: (entity: any) => {
						if (entity === DBAlbum) return albRepo;
						if (entity === DBAlbumIdentity) return idRepo;
						return null;
					},
				};
				return cb(tm);
			});

			const result = await service.resolveAlbum(
				"p1",
				"id1",
				"identity-val",
				true,
			);
			expect(result).toBe("new-album");
			expect(albRepo.save).toHaveBeenCalled();
			expect(idRepo.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					pluginId: "p1",
					identifierId: "id1",
					identity: "identity-val",
					albumUuid: "new-album",
					ordinal: 0,
				}),
			);
		});
	});

	describe("setTrackLinks", () => {
		it("deletes old links and inserts new ones in a transaction", async () => {
			const atRepo = {
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
				create: jest.fn((obj: any) => obj),
			};
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = {
					getRepository: () => atRepo,
				};
				return cb(tm);
			});

			await service.setTrackLinks(
				{ uuid: "t1" } as any,
				["a1", "a2"],
				"p1",
				"id1",
			);

			expect(atRepo.delete).toHaveBeenCalledWith({
				trackUuid: "t1",
				pluginId: "p1",
				identifierId: "id1",
			});
			expect(atRepo.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						trackUuid: "t1",
						albumUuid: "a1",
						discNumber: 1,
						trackNumber: 0,
					}),
					expect.objectContaining({
						trackUuid: "t1",
						albumUuid: "a2",
					}),
				]),
			);
		});

		it("uses provided position when given", async () => {
			const atRepo = {
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
				create: jest.fn((obj: any) => obj),
			};
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = { getRepository: () => atRepo };
				return cb(tm);
			});

			await service.setTrackLinks(
				{ uuid: "t1" } as any,
				["a1"],
				"p1",
				"id1",
				{ disc: 2, track: 5 },
			);

			expect(atRepo.insert).toHaveBeenCalledWith(
				[
					expect.objectContaining({
						discNumber: 2,
						trackNumber: 5,
					}),
				],
			);
		});

		it("skips insert when albumUuids is empty", async () => {
			const atRepo = {
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
				create: jest.fn(),
			};
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = { getRepository: () => atRepo };
				return cb(tm);
			});

			await service.setTrackLinks(
				{ uuid: "t1" } as any,
				[],
				"p1",
				"id1",
			);

			expect(atRepo.insert).not.toHaveBeenCalled();
		});
	});

	describe("clearTrackLinks", () => {
		it("deletes track links for the plugin/identifier", async () => {
			await service.clearTrackLinks(
				{ uuid: "t1" } as any,
				"p1",
				"id1",
			);
			expect(albumTracksRepo.delete).toHaveBeenCalledWith({
				trackUuid: "t1",
				pluginId: "p1",
				identifierId: "id1",
			});
		});
	});

	describe("clearArtistLinks", () => {
		it("deletes artist links for the plugin/identifier", async () => {
			await service.clearArtistLinks(
				{ uuid: "a1" } as any,
				"p1",
				"id1",
			);
			expect(albumArtistsRepo.delete).toHaveBeenCalledWith({
				albumUuid: "a1",
				pluginId: "p1",
				identifierId: "id1",
			});
		});
	});

	describe("setArtistLinks", () => {
		it("clears then inserts with ordinal", async () => {
			albumArtistsRepo.insert.mockResolvedValue(undefined);
			await service.setArtistLinks(
				{ uuid: "a1" } as any,
				["ar1", "ar2"],
				"p1",
				"id1",
			);
			expect(albumArtistsRepo.delete).toHaveBeenCalledWith({
				albumUuid: "a1",
				pluginId: "p1",
				identifierId: "id1",
			});
			expect(albumArtistsRepo.insert).toHaveBeenCalledWith([
				expect.objectContaining({ albumUuid: "a1", artistUuid: "ar1", ordinal: 0 }),
				expect.objectContaining({ albumUuid: "a1", artistUuid: "ar2", ordinal: 1 }),
			]);
		});
	});

	describe("setJoinPhrase", () => {
		it("updates the join phrase", async () => {
			await service.setJoinPhrase("a1", "ar1", "featuring");
			expect(albumArtistsRepo.update).toHaveBeenCalledWith(
				{ albumUuid: "a1", artistUuid: "ar1" },
				{ joinPhrase: "featuring" },
			);
		});

		it("sets null join phrase", async () => {
			await service.setJoinPhrase("a1", "ar1", null);
			expect(albumArtistsRepo.update).toHaveBeenCalledWith(
				{ albumUuid: "a1", artistUuid: "ar1" },
				{ joinPhrase: null },
			);
		});
	});

	describe("registerIdentifier", () => {
		it("stores identifier for new plugin", () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			service.registerIdentifier(identifier, plugin);
			expect(service.getIdentifiers()).toHaveLength(1);
			expect(service.getIdentifiers()[0].identifier.id).toBe("id1");
		});

		it("stores second identifier for same plugin", () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);
			service.registerIdentifier(makeIdentifier("id2"), plugin);
			expect(service.getIdentifiers()).toHaveLength(2);
		});

		it("throws on duplicate id for same plugin", () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);
			expect(() =>
				service.registerIdentifier(makeIdentifier("id1"), plugin),
			).toThrow(/already registered/);
		});

		it("same id in different plugins is allowed", () => {
			const pluginA = makePlugin("plug-a");
			const pluginB = makePlugin("plug-b");
			service.registerIdentifier(makeIdentifier("id1"), pluginA);
			service.registerIdentifier(makeIdentifier("id1"), pluginB);
			expect(service.getIdentifiers()).toHaveLength(2);
		});
	});

	describe("unregisterIdentifier", () => {
		it("removes identifier", () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			service.registerIdentifier(identifier, plugin);
			service.unregisterIdentifier(identifier, plugin);
			expect(service.getIdentifiers()).toHaveLength(0);
		});

		it("no-op for unknown plugin", () => {
			const plugin = makePlugin("unknown");
			expect(() =>
				service.unregisterIdentifier(makeIdentifier("id1"), plugin),
			).not.toThrow();
		});

		it("throws DeregistrationBlockedError when dependent exists", () => {
			const pluginA = makePlugin("plug-a");
			const pluginB = makePlugin("plug-b");
			const dep = { pluginId: null, sourceId: "id-a" };
			const idA = makeIdentifier("id-a");
			const idB = makeIdentifier("id-b", [dep]);

			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idB, pluginB);

			expect(() =>
				service.unregisterIdentifier(idA, pluginA),
			).toThrow(DeregistrationBlockedError);
		});

		it("allows unregister when no dependents", () => {
			const pluginA = makePlugin("plug-a");
			const pluginB = makePlugin("plug-b");
			const idA = makeIdentifier("id-a");
			const idB = makeIdentifier("id-b");

			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idB, pluginB);

			expect(() =>
				service.unregisterIdentifier(idA, pluginA),
			).not.toThrow();
			expect(service.getIdentifiers()).toHaveLength(1);
		});
	});

	describe("registerTrackIdentifier", () => {
		it("adds to trackIdentifiers list", () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("track-id");
			service.registerTrackIdentifier(identifier, plugin);
			expect((service as any).trackIdentifiers).toEqual([
				{ sourceId: "track-id", pluginId: "plug-a" },
			]);
		});
	});

	describe("unregisterTrackIdentifier", () => {
		it("removes from trackIdentifiers", () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("track-id");
			service.registerTrackIdentifier(identifier, plugin);
			service.unregisterTrackIdentifier(identifier, plugin);
			expect((service as any).trackIdentifiers).toHaveLength(0);
		});

		it("no-op for unknown", () => {
			const plugin = makePlugin("unknown");
			expect(() =>
				service.unregisterTrackIdentifier(makeIdentifier("x"), plugin),
			).not.toThrow();
		});
	});

	describe("findIdentities", () => {
		it("accepts string uuid", () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			service.findIdentities("album-uuid");
			expect(identitiesRepo.findBy).toHaveBeenCalledWith({
				albumUuid: "album-uuid",
			});
		});

		it("accepts album object", () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			service.findIdentities({ uuid: "album-uuid" } as any);
			expect(identitiesRepo.findBy).toHaveBeenCalledWith({
				albumUuid: "album-uuid",
			});
		});
	});

	describe("getInformationHelper", () => {
		it("returns helper with getAlbumUuid and getIdentity", async () => {
			const identityRow = {
				identifierId: "id1",
				pluginId: "p1",
				toIdentity: () => ({ identityId: "id1", pluginId: "p1" }),
			};
			identitiesRepo.findBy.mockResolvedValue([identityRow]);

			const album = { uuid: "a1" } as any;
			const helper = await service.getInformationHelper(album);

			expect(helper.getAlbumUuid()).toBe("a1");
			expect(helper.getIdentity("id1", "p1", false)).toEqual({
				identityId: "id1",
				pluginId: "p1",
			});
			expect(helper.getIdentity("missing", null, false)).toBeNull();
		});

		it("returns array when multiple is true", async () => {
			const identityRow = {
				identifierId: "id1",
				pluginId: "p1",
				toIdentity: () => ({ identityId: "id1", pluginId: "p1" }),
			};
			identitiesRepo.findBy.mockResolvedValue([identityRow]);

			const helper = await service.getInformationHelper({ uuid: "a1" } as any);
			expect(helper.getIdentity("id1", "p1", true)).toEqual([
				{ identityId: "id1", pluginId: "p1" },
			]);
		});

		it("uses custom getIdentities when provided", async () => {
			const customIdentities = (id: string) =>
				id === "custom"
					? [{ identityId: "custom", pluginId: null }]
					: [];

			const helper = await service.getInformationHelper(
				{ uuid: "a1" } as any,
				customIdentities as any,
			);
			expect(helper.getIdentity("custom", null, false)).toEqual({
				identityId: "custom",
				pluginId: null,
			});
			expect(helper.getIdentity("other", null, false)).toBeNull();
		});
	});

	describe("getExternalUrls", () => {
		it("delegates to externalUrlsService.getAlbumUrls", async () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			const urls = [{ url: "https://example.com", name: "Example" }];
			mockExternalUrlsService.getAlbumUrls.mockReturnValue(urls);

			const result = await service.getExternalUrls({ uuid: "a1" } as any);
			expect(result).toBe(urls);
			expect(mockExternalUrlsService.getAlbumUrls).toHaveBeenCalledWith(
				expect.objectContaining({
					getAlbumUuid: expect.any(Function),
					getIdentity: expect.any(Function),
				}),
			);
		});
	});

	describe("cleanIdentities", () => {
		it("deleteAll when no identifiers registered", async () => {
			const deleteAllMock = jest.fn();
			(identitiesRepo as any).deleteAll = deleteAllMock;

			await service.cleanIdentities();
			expect(deleteAllMock).toHaveBeenCalled();
		});

		it("uses query builder when identifiers exist", async () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);

			const qb = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			identitiesRepo.createQueryBuilder.mockReturnValue(qb);
			albumArtistsRepo.createQueryBuilder.mockReturnValue({
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			});

			await service.cleanIdentities();
			expect(qb.execute).toHaveBeenCalled();
		});
	});

	describe("forEachAlbumId", () => {
		it("calls callback for each album", async () => {
			const callback = jest.fn();
			albumsRepo.find
				.mockResolvedValueOnce([{ uuid: "a1" }, { uuid: "a2" }])
				.mockResolvedValueOnce([]);

			await service.forEachAlbumId(callback);

			expect(callback).toHaveBeenCalledTimes(2);
			expect(callback).toHaveBeenCalledWith(
				"a1",
				expect.any(Function),
			);
			expect(callback).toHaveBeenCalledWith(
				"a2",
				expect.any(Function),
			);
		});

		it("stops when cancel is called", async () => {
			const callback = jest.fn((_uuid: string, cancel: () => void) => {
				cancel();
			});
			albumsRepo.find.mockResolvedValue([{ uuid: "a1" }, { uuid: "a2" }]);

			await service.forEachAlbumId(callback);

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});
});
