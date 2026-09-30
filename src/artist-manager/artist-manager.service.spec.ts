import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { ArtistManagerService } from "./artist-manager.service";
import { DBArtist } from "./entity/artist.entity";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DeregistrationBlockedError } from "src/util/deregistration-blocked.error";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { ArtistIdentityTarget } from "./enum/artist-identity-target.enum";
import { DBArtistMerge } from "./entity/artist-merge.entity";

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
		identify: jest.fn(),
	}) as any;

describe("ArtistManagerService", () => {
	let service: ArtistManagerService;
	let artistsRepo: ReturnType<typeof createMockRepo>;
	let identitiesRepo: ReturnType<typeof createMockRepo>;
	let trackArtistsRepo: ReturnType<typeof createMockRepo>;
	let mockExternalUrlsService: {
		getArtistUrls: jest.Mock;
	};
	let mockTrackManagerService: { find: jest.Mock };
	let mockAlbumManagerService: { findForArtist: jest.Mock };
	let mockDataSource: { transaction: jest.Mock };

	beforeEach(async () => {
		artistsRepo = createMockRepo();
		identitiesRepo = createMockRepo();
		trackArtistsRepo = createMockRepo();
		mockExternalUrlsService = { getArtistUrls: jest.fn() };
		mockTrackManagerService = { find: jest.fn() };
		mockAlbumManagerService = { findForArtist: jest.fn() };
		mockDataSource = { transaction: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ArtistManagerService,
				{
					provide: getRepositoryToken(DBArtist),
					useValue: artistsRepo,
				},
				{
					provide: getRepositoryToken(DBArtistIdentity),
					useValue: identitiesRepo,
				},
				{
					provide: getRepositoryToken(DBTrackArtist),
					useValue: trackArtistsRepo,
				},
				{
					provide: ExternalUrlsService,
					useValue: mockExternalUrlsService,
				},
				{
					provide: TrackManagerService,
					useValue: mockTrackManagerService,
				},
				{
					provide: AlbumManagerService,
					useValue: mockAlbumManagerService,
				},
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get(ArtistManagerService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("setJoinPhrase", () => {
		it("updates the track-artist join phrase", async () => {
			await service.setJoinPhrase("t1", "a1", "featuring");
			expect(trackArtistsRepo.update).toHaveBeenCalledWith(
				{ trackUuid: "t1", artistUuid: "a1" },
				{ joinPhrase: "featuring" },
			);
		});

		it("sets null join phrase", async () => {
			await service.setJoinPhrase("t1", "a1", null);
			expect(trackArtistsRepo.update).toHaveBeenCalledWith(
				{ trackUuid: "t1", artistUuid: "a1" },
				{ joinPhrase: null },
			);
		});
	});

	describe("resolveArtist", () => {
		it("returns existing artistUuid", async () => {
			identitiesRepo.findOne.mockResolvedValue({ artistUuid: "existing" });
			const result = await service.resolveArtist(
				"p1",
				"id1",
				"val",
				ArtistIdentityTarget.ARTIST,
			);
			expect(result).toBe("existing");
		});

		it("returns null when not found and no create", async () => {
			identitiesRepo.findOne.mockResolvedValue(null);
			const result = await service.resolveArtist(
				"p1",
				"id1",
				"val",
				ArtistIdentityTarget.ARTIST,
			);
			expect(result).toBeNull();
		});

		it("creates artist in transaction when createIfMissing", async () => {
			identitiesRepo.findOne.mockResolvedValue(null);
			const savedArtist = { uuid: "new-artist" };
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const manager = {
					create: (entity: any, data?: any) =>
						entity === DBArtist ? {} : { ...data },
					save: jest.fn().mockResolvedValue(savedArtist),
				};
				return cb(manager);
			});

			const result = await service.resolveArtist(
				"p1",
				"id1",
				"val",
				ArtistIdentityTarget.ARTIST,
				true,
			);
			expect(result).toBe("new-artist");
		});

		it("creates the identity row with target, ordinal and value", async () => {
			identitiesRepo.findOne.mockResolvedValue(null);
			const savedArtist = { uuid: "new-artist" };
			const created: { entity: any; value: any }[] = [];
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const manager = {
					create: (entity: any, data?: any) => {
						const value = entity === DBArtist ? {} : { ...data };
						created.push({ entity, value });
						return value;
					},
					save: jest.fn().mockResolvedValue(savedArtist),
				};
				return cb(manager);
			});

			await service.resolveArtist(
				"p1",
				"id1",
				"val",
				ArtistIdentityTarget.ALBUM,
				true,
			);

			const identityCreate = created.find((c) => c.entity === DBArtistIdentity);
			expect(identityCreate?.value).toEqual({
				artistUuid: "new-artist",
				pluginId: "p1",
				identifierId: "id1",
				identity: "val",
				target: ArtistIdentityTarget.ALBUM,
				ordinal: 0,
				originalArtistUuid: "new-artist",
			});
		});
	});

	describe("clearTrackLinks", () => {
		it("deletes track-artist links", async () => {
			await service.clearTrackLinks(
				{ uuid: "t1" } as any,
				"p1",
				"id1",
			);
			expect(trackArtistsRepo.delete).toHaveBeenCalledWith({
				trackUuid: "t1",
				pluginId: "p1",
				identifierId: "id1",
			});
		});
	});

	describe("setTrackLinks", () => {
		it("clears then inserts with ordinal", async () => {
			trackArtistsRepo.insert.mockResolvedValue(undefined);
			await service.setTrackLinks(
				{ uuid: "t1" } as any,
				["a1", "a2"],
				"p1",
				"id1",
			);
			expect(trackArtistsRepo.delete).toHaveBeenCalledWith({
				trackUuid: "t1",
				pluginId: "p1",
				identifierId: "id1",
			});
			expect(trackArtistsRepo.insert).toHaveBeenCalledWith([
				expect.objectContaining({
					trackUuid: "t1",
					artistUuid: "a1",
					ordinal: 0,
				}),
				expect.objectContaining({
					trackUuid: "t1",
					artistUuid: "a2",
					ordinal: 1,
				}),
			]);
		});

		it("clears links and inserts nothing for empty artistUuids", async () => {
			await service.setTrackLinks({ uuid: "t1" } as any, [], "p1", "id1");
			expect(trackArtistsRepo.delete).toHaveBeenCalledWith({
				trackUuid: "t1",
				pluginId: "p1",
				identifierId: "id1",
			});
			expect(trackArtistsRepo.insert).toHaveBeenCalledWith([]);
		});
	});

	describe("findOne", () => {
		it("returns null when artist not found", async () => {
			artistsRepo.findOne.mockResolvedValue(null);
			await expect(service.findOne("missing", {})).resolves.toBeNull();
		});

		it("returns artist with basic relations", async () => {
			artistsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			const result = await service.findOne("a1", {
				withAttributes: true,
				withIdentities: true,
			});
			expect(result).toEqual({ uuid: "a1" });
		});

		it("loads tracks when withTracks is true", async () => {
			artistsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			mockTrackManagerService.find.mockResolvedValue([
				{ uuid: "t1" },
				{ uuid: "t2" },
			]);
			trackArtistsRepo.find.mockResolvedValue([
				{ trackUuid: "t1" },
				{ trackUuid: "t2" },
			]);

			const result = await service.findOne("a1", { withTracks: true } as any);
			expect(mockTrackManagerService.find).toHaveBeenCalled();
			expect(result!.tracks).toHaveLength(2);
		});

		it("loads albums when withAlbums is true", async () => {
			artistsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			mockAlbumManagerService.findForArtist.mockResolvedValue([
				{ albumUuid: "al1" },
			]);

			const result = await service.findOne("a1", { withAlbums: true } as any);
			expect(mockAlbumManagerService.findForArtist).toHaveBeenCalled();
			expect(result!.albums).toHaveLength(1);
		});

		it("limits tracks when withTracks is a number", async () => {
			artistsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			mockTrackManagerService.find.mockResolvedValue([]);
			trackArtistsRepo.find.mockResolvedValue([]);

			await service.findOne("a1", { withTracks: 5 } as any);
			expect(mockTrackManagerService.find).toHaveBeenCalledWith({
				where: {
					artists: { artistUuid: "a1" },
				},
				take: 5,
				select: ["uuid"],
			});
		});

		it("omits relation flags when options are not set", async () => {
			artistsRepo.findOne.mockResolvedValue(null);
			await service.findOne("missing", {});
			expect(artistsRepo.findOne).toHaveBeenCalledWith({
				where: { uuid: "missing" },
				relationLoadStrategy: "query",
				relations: {
					attributes: undefined,
					identities: undefined,
				},
			});
		});

		it("passes album sub-options through to findForArtist", async () => {
			artistsRepo.findOne.mockResolvedValue({ uuid: "a1" });
			mockAlbumManagerService.findForArtist.mockResolvedValue([]);

			await service.findOne("a1", {
				withAlbums: true,
				withAlbumIdentities: true,
				withAlbumAttributes: true,
				withAlbumArtists: true,
			} as any);

			expect(mockAlbumManagerService.findForArtist).toHaveBeenCalledWith(
				expect.objectContaining({ uuid: "a1" }),
				{
					withIdentities: true,
					withAttributes: true,
					withArtists: true,
					withArtistIdentities: undefined,
					withArtistAttributes: undefined,
					withTracks: undefined,
					withTrackIdentities: undefined,
					withTrackAttributes: undefined,
				},
			);
		});
	});

	describe("findIdentities", () => {
		it("accepts string", () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			service.findIdentities("uuid1");
			expect(identitiesRepo.findBy).toHaveBeenCalledWith({
				artistUuid: "uuid1",
			});
		});

		it("accepts artist object", () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			service.findIdentities({ uuid: "uuid1" } as any);
			expect(identitiesRepo.findBy).toHaveBeenCalledWith({
				artistUuid: "uuid1",
			});
		});
	});

	describe("findMany", () => {
		it("passes options with relations", async () => {
			artistsRepo.find.mockResolvedValue([]);
			await service.findMany({ amount: 10, offset: 5, withAttributes: true });
			expect(artistsRepo.find).toHaveBeenCalledWith({
				take: 10,
				skip: 5,
				relationLoadStrategy: "query",
				select: undefined,
				relations: {
					attributes: true,
					identities: undefined,
				},
			});
		});
	});

	describe("findManyRaw", () => {
		it("delegates directly", async () => {
			artistsRepo.find.mockResolvedValue([{ uuid: "x" }]);
			const opts = { take: 1 } as any;
			await expect(service.findManyRaw(opts)).resolves.toEqual([{ uuid: "x" }]);
			expect(artistsRepo.find).toHaveBeenCalledWith(opts);
		});
	});

	describe("updateAttributionRunId", () => {
		it("updates with In()", async () => {
			await service.updateAttributionRunId("run1", ["a1", "a2"]);
			expect(artistsRepo.update).toHaveBeenCalledWith(
				{ uuid: In(["a1", "a2"]) },
				{ lastAttributionRunId: "run1" },
			);
		});
	});

	describe("findMany (relations)", () => {
		it("includes identities relation when withIdentities is true", async () => {
			artistsRepo.find.mockResolvedValue([]);
			await service.findMany({ amount: 1, withIdentities: true });
			expect(artistsRepo.find).toHaveBeenCalledWith({
				take: 1,
				skip: undefined,
				relationLoadStrategy: "query",
				select: undefined,
				relations: {
					attributes: undefined,
					identities: true,
				},
			});
		});
	});

	describe("count", () => {
		it("delegates to countBy", async () => {
			artistsRepo.countBy.mockResolvedValue(3);
			await expect(service.count({} as any)).resolves.toBe(3);
		});

		it("delegates an array of where clauses to countBy", async () => {
			artistsRepo.countBy.mockResolvedValue(1);
			const where = [{ uuid: "a1" }, { uuid: "a2" }];
			await service.count(where as any);
			expect(artistsRepo.countBy).toHaveBeenCalledWith(where);
		});
	});

	describe("registerIdentifier", () => {
		it("stores for new plugin", () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);
			expect(service.getIdentifiers()).toHaveLength(1);
		});

		it("throws on duplicate", () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);
			expect(() =>
				service.registerIdentifier(makeIdentifier("id1"), plugin),
			).toThrow(/already registered/);
		});

		it("allows same id across plugins", () => {
			service.registerIdentifier(
				makeIdentifier("id1"),
				makePlugin("plug-a"),
			);
			service.registerIdentifier(
				makeIdentifier("id1"),
				makePlugin("plug-b"),
			);
			expect(service.getIdentifiers()).toHaveLength(2);
		});

		it("adds a second identifier to an existing plugin", () => {
			const plugin = makePlugin("plug-a");
			service.registerIdentifier(makeIdentifier("id1"), plugin);
			service.registerIdentifier(makeIdentifier("id2"), plugin);
			expect(service.getIdentifiers()).toHaveLength(2);
		});
	});

	describe("unregisterIdentifier", () => {
		it("removes identifier", () => {
			const plugin = makePlugin("plug-a");
			const id = makeIdentifier("id1");
			service.registerIdentifier(id, plugin);
			service.unregisterIdentifier(id, plugin);
			expect(service.getIdentifiers()).toHaveLength(0);
		});

		it("no-op for unknown plugin", () => {
			expect(() =>
				service.unregisterIdentifier(
					makeIdentifier("x"),
					makePlugin("unknown"),
				),
			).not.toThrow();
		});

		it("throws when dependent identifier exists", () => {
			const pluginA = makePlugin("plug-a");
			const pluginB = makePlugin("plug-b");
			const idA = makeIdentifier("id-a");
			const idB = makeIdentifier("id-b", [
				{ pluginId: null, sourceId: "id-a" },
			]);

			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idB, pluginB);

			expect(() => service.unregisterIdentifier(idA, pluginA)).toThrow(
				DeregistrationBlockedError,
			);
		});

		it("throws when a plugin-scoped dependent identifier exists", () => {
			const pluginA = makePlugin("plug-a");
			const pluginC = makePlugin("plug-c");
			const idA = makeIdentifier("id-a");
			const idC = makeIdentifier("id-c", [
				{ pluginId: "plug-a", sourceId: "id-a" },
			]);

			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idC, pluginC);

			expect(() => service.unregisterIdentifier(idA, pluginA)).toThrow(
				DeregistrationBlockedError,
			);
		});

		it("succeeds when dependent uses a different plugin id", () => {
			const pluginA = makePlugin("plug-a");
			const pluginC = makePlugin("plug-c");
			const idA = makeIdentifier("id-a");
			const idC = makeIdentifier("id-c", [
				{ pluginId: "plug-c", sourceId: "id-a" },
			]);

			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idC, pluginC);

			expect(() => service.unregisterIdentifier(idA, pluginA)).not.toThrow();
			// idC is pruned from the ordered list because its explicit-plugin
			// dependency cannot be resolved
			expect(service.getIdentifiers()).toHaveLength(0);
		});
	});

	describe("registerTrackIdentifier", () => {
		it("adds to track identifiers", () => {
			service.registerTrackIdentifier(
				makeIdentifier("tid"),
				makePlugin("plug-a"),
			);
			expect((service as any).trackIdentifiers).toEqual([
				{ sourceId: "tid", pluginId: "plug-a" },
			]);
		});
	});

	describe("unregisterTrackIdentifier", () => {
		it("removes from track identifiers", () => {
			const plugin = makePlugin("plug-a");
			const id = makeIdentifier("tid");
			service.registerTrackIdentifier(id, plugin);
			service.unregisterTrackIdentifier(id, plugin);
			expect((service as any).trackIdentifiers).toHaveLength(0);
		});

		it("no-op for unknown identifier", () => {
			expect(() =>
				service.unregisterTrackIdentifier(
					makeIdentifier("x"),
					makePlugin("plug-a"),
				),
			).not.toThrow();
			expect((service as any).trackIdentifiers).toHaveLength(0);
		});
	});

	describe("getInformationHelper", () => {
		it("returns helper with getArtistUuid and getIdentity", async () => {
			identitiesRepo.findBy.mockResolvedValue([
				{
					identifierId: "id1",
					pluginId: "p1",
					toIdentity: () => ({ identityId: "id1", pluginId: "p1" }),
				},
			]);

			const helper = await service.getInformationHelper({ uuid: "a1" } as any);
			expect(helper.getArtistUuid()).toBe("a1");
			expect(helper.getIdentity("id1", "p1", false)).toEqual({
				identityId: "id1",
				pluginId: "p1",
			});
			expect(helper.getIdentity("missing", null, false)).toBeNull();
		});

		it("returns array when multiple=true", async () => {
			identitiesRepo.findBy.mockResolvedValue([
				{
					identifierId: "id1",
					pluginId: "p1",
					toIdentity: () => ({ identityId: "id1", pluginId: "p1" }),
				},
			]);
			const helper = await service.getInformationHelper({ uuid: "a1" } as any);
			expect(helper.getIdentity("id1", "p1", true)).toHaveLength(1);
		});

		it("uses custom getIdentities", async () => {
			const helper = await service.getInformationHelper(
				{ uuid: "a1" } as any,
				((id: string) =>
					[
						{ identityId: id, pluginId: null },
					] as any) as any,
			);
			expect(helper.getIdentity("custom", null, false)).toEqual({
				identityId: "custom",
				pluginId: null,
			});
		});

		it("filters the default lookup by pluginId", async () => {
			identitiesRepo.findBy.mockResolvedValue([
				{
					identifierId: "id1",
					pluginId: "p1",
					toIdentity: () => ({ identityId: "id1", pluginId: "p1" }),
				},
				{
					identifierId: "id1",
					pluginId: "p2",
					toIdentity: () => ({ identityId: "id1", pluginId: "p2" }),
				},
			]);

			const helper = await service.getInformationHelper({ uuid: "a1" } as any);
			expect(helper.getIdentity("id1", "p2", false)).toEqual({
				identityId: "id1",
				pluginId: "p2",
			});
			expect(helper.getIdentity("id1", "p3", false)).toBeNull();
			expect(helper.getIdentity("id1", null, false)).toEqual({
				identityId: "id1",
				pluginId: "p1",
			});
		});

		it("returns null when custom getIdentities returns null", async () => {
			const helper = await service.getInformationHelper(
				{ uuid: "a1" } as any,
				(() => null) as any,
			);
			expect(helper.getIdentity("anything", null, false)).toBeNull();
		});
	});

	describe("identifyArtist", () => {
		it("returns empty when no identifiers registered", async () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			const result = await service.identifyArtist(
				{ uuid: "a1" } as any,
				"run1",
			);
			expect(result).toEqual({
				identities: [],
				mergedArtists: ["a1"],
				splitCount: 0,
			});
		});

		it("runs identifier and stores new identities", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["new-id-value"]);

			service.registerIdentifier(identifier, plugin);

			identitiesRepo.findBy.mockResolvedValue([]);
			identitiesRepo.find.mockResolvedValue([]);
			identitiesRepo.create.mockImplementation(
				(data: any) => ({ ...data, id: "row1" }),
			);
			artistsRepo.update.mockResolvedValue(undefined);

			// No existing matches → single-artist path
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = {
					getRepository: (entity: any) => {
						if (entity === DBArtist)
							return {
								update: jest.fn().mockResolvedValue(undefined),
							};
						if (entity === DBArtistIdentity)
							return {
								delete: jest.fn().mockResolvedValue(undefined),
								insert: jest.fn().mockResolvedValue(undefined),
							};
						return {};
					},
				};
				return cb(tm);
			});

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
			);

			expect(identifier.identify).toHaveBeenCalled();
			expect(result.mergedArtists).toContain("a1");
		});

		it("skips disabled identifiers", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["val"]);
			service.registerIdentifier(identifier, plugin);

			identitiesRepo.findBy.mockResolvedValue([]);
			artistsRepo.update.mockResolvedValue(undefined);

			const disabledSet = new Set([
				`plug-a:id1:artist`,
			]);

			identitiesRepo.delete.mockResolvedValue(undefined);

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
				disabledSet,
			);

			expect(identifier.identify).not.toHaveBeenCalled();
			expect(identitiesRepo.delete).toHaveBeenCalled();
		});

		it("continues when identifier throws", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockRejectedValue(new Error("boom"));
			service.registerIdentifier(identifier, plugin);

			identitiesRepo.findBy.mockResolvedValue([]);
			artistsRepo.update.mockResolvedValue(undefined);

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
			);

			expect(identifier.identify).toHaveBeenCalled();
			// No new entries → early return
			expect(result.identities).toEqual([]);
		});

		it("disables dependent identifier when its dependency is disabled", async () => {
			const pluginA = makePlugin("plug-a");
			const pluginB = makePlugin("plug-b");
			const idA = makeIdentifier("id-a");
			const idB = makeIdentifier("id-b", [
				{ pluginId: "plug-a", sourceId: "id-a" },
			]);
			service.registerIdentifier(idA, pluginA);
			service.registerIdentifier(idB, pluginB);

			identitiesRepo.findBy.mockResolvedValue([]);
			artistsRepo.update.mockResolvedValue(undefined);
			identitiesRepo.delete.mockResolvedValue(undefined);

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
				new Set(["plug-a:id-a:artist"]),
			);

			expect(idA.identify).not.toHaveBeenCalled();
			expect(idB.identify).not.toHaveBeenCalled();
			expect(identitiesRepo.delete).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				identities: [],
				mergedArtists: ["a1"],
				splitCount: 0,
			});
		});

		it("deletes stored identities when identifier returns an empty list", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue([]);
			service.registerIdentifier(identifier, plugin);

			identitiesRepo.findBy.mockResolvedValue([
				{
					identifierId: "id1",
					pluginId: "plug-a",
					identity: "old",
					target: ArtistIdentityTarget.ARTIST,
					ordinal: 0,
					originalArtistUuid: "a1",
					toIdentity: () => ({ identityId: "id1", pluginId: "plug-a" }),
				},
			]);
			artistsRepo.update.mockResolvedValue(undefined);
			identitiesRepo.delete.mockResolvedValue(undefined);

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
			);

			expect(identitiesRepo.delete).toHaveBeenCalledWith({
				artistUuid: "a1",
				identifierId: "id1",
				pluginId: "plug-a",
				target: ArtistIdentityTarget.ARTIST,
			});
			expect(result).toEqual({
				identities: [],
				mergedArtists: ["a1"],
				splitCount: 0,
			});
		});

		it("merges into the oldest artist when identity matches another artist", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["val"]);
			service.registerIdentifier(identifier, plugin);

			identitiesRepo.findBy.mockResolvedValue([]);
			identitiesRepo.create.mockImplementation((data: any) => ({ ...data }));
			identitiesRepo.find.mockResolvedValue([
				{
					pluginId: "plug-a",
					identifierId: "id1",
					identity: "val",
					artist: { uuid: "a2", dateAdded: 1000 },
				},
			]);

			const artistsTxRepo = {
				delete: jest.fn().mockResolvedValue(undefined),
				update: jest.fn().mockResolvedValue(undefined),
			};
			const idTxRepo = {
				findBy: jest.fn().mockResolvedValue([]),
				create: jest.fn((data: any) => ({ ...data })),
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
			};
			const attrTxRepo = {
				find: jest.fn().mockResolvedValue([]),
				create: jest.fn(),
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
			};
			const trackTxRepo = {
				findBy: jest.fn().mockResolvedValue([]),
				create: jest.fn(),
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
			};
			const albumTxRepo = {
				findBy: jest.fn().mockResolvedValue([]),
				create: jest.fn(),
				delete: jest.fn().mockResolvedValue(undefined),
				insert: jest.fn().mockResolvedValue(undefined),
			};
			const mergeTxRepo = {
				insert: jest.fn().mockResolvedValue(undefined),
			};

			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = {
					getRepository: (entity: any) => {
						if (entity === DBArtist) return artistsTxRepo;
						if (entity === DBArtistIdentity) return idTxRepo;
						if (entity === DBTrackArtist) return trackTxRepo;
						if (entity === DBArtistAttribute) return attrTxRepo;
						if (entity === DBAlbumArtist) return albumTxRepo;
						if (entity === DBArtistMerge) return mergeTxRepo;
						return {};
					},
				};
				return cb(tm);
			});

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: 2000 } as any,
				"run1",
			);

			// a2 is older → master; a1 gets removed and tombstoned
			expect(result.mergedArtists).toEqual(["a2", "a1"]);
			expect(result.identities).toHaveLength(1);
			expect(artistsTxRepo.update).toHaveBeenCalledWith("a2", {
				lastIdentificationRunId: "run1",
			});
			expect(artistsTxRepo.delete).toHaveBeenCalledWith({ uuid: In(["a1"]) });
			expect(mergeTxRepo.insert).toHaveBeenCalledWith([
				expect.objectContaining({
					mergedUuid: "a1",
					masterUuid: "a2",
				}),
			]);
		});

		it("splits merged origins into separate artists", async () => {
			const plugin = makePlugin("plug-a");
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue([]);
			service.registerIdentifier(identifier, plugin);

			const makeRow = (identity: string, original: string) => ({
				identifierId: "id1",
				pluginId: "plug-a",
				identity,
				target: ArtistIdentityTarget.ARTIST,
				ordinal: 0,
				originalArtistUuid: original,
				toIdentity: () => ({ identityId: "id1", pluginId: "plug-a" }),
			});

			identitiesRepo.findBy
				.mockResolvedValueOnce([
					makeRow("v2", "a2"),
					makeRow("v3", "a3"),
				])
				.mockResolvedValue([]);

			identitiesRepo.create.mockImplementation((data: any) => ({ ...data }));
			artistsRepo.update.mockResolvedValue(undefined);
			identitiesRepo.delete.mockResolvedValue(undefined);

			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const tm = {
					getRepository: (_entity: any) => ({
						create: jest.fn((data?: any) => ({})),
						save: jest.fn().mockResolvedValue({ uuid: "split" }),
						findBy: jest.fn().mockResolvedValue([]),
						delete: jest.fn().mockResolvedValue(undefined),
						insert: jest.fn().mockResolvedValue(undefined),
						update: jest.fn().mockResolvedValue(undefined),
					}),
				};
				return cb(tm);
			});

			const result = await service.identifyArtist(
				{ uuid: "a1", dateAdded: Date.now() } as any,
				"run1",
			);

			expect(result.splitCount).toBe(2);
			expect(result.mergedArtists).toEqual(["a1"]);
		});
	});

	describe("getExternalUrls", () => {
		it("delegates to externalUrlsService.getArtistUrls", async () => {
			identitiesRepo.findBy.mockResolvedValue([]);
			mockExternalUrlsService.getArtistUrls.mockReturnValue([
				{ url: "https://x.com" },
			]);

			const result = await service.getExternalUrls({ uuid: "a1" } as any);
			expect(result).toEqual([{ url: "https://x.com" }]);
			expect(mockExternalUrlsService.getArtistUrls).toHaveBeenCalledWith(
				expect.objectContaining({
					getArtistUuid: expect.any(Function),
				}),
			);
		});
	});

	describe("cleanIdentities", () => {
		it("deleteAll when no identifiers", async () => {
			const deleteAll = jest.fn();
			(identitiesRepo as any).deleteAll = deleteAll;
			await service.cleanIdentities();
			expect(deleteAll).toHaveBeenCalled();
		});

		it("uses query builder when identifiers exist", async () => {
			service.registerIdentifier(
				makeIdentifier("id1"),
				makePlugin("plug-a"),
			);

			const qb = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			identitiesRepo.createQueryBuilder.mockReturnValue(qb);
			trackArtistsRepo.createQueryBuilder.mockReturnValue({
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			});

			await service.cleanIdentities();
			expect(qb.execute).toHaveBeenCalled();
		});

		it("includes track identifiers in the where clause", async () => {
			service.registerIdentifier(
				makeIdentifier("id1"),
				makePlugin("plug-a"),
			);
			service.registerTrackIdentifier(
				makeIdentifier("tid"),
				makePlugin("plug-b"),
			);

			const where = jest.fn().mockReturnThis();
			const qb = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where,
				execute: jest.fn().mockResolvedValue(undefined),
			};
			identitiesRepo.createQueryBuilder.mockReturnValue(qb);
			trackArtistsRepo.createQueryBuilder.mockReturnValue({
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			});

			await service.cleanIdentities();

			expect(where).toHaveBeenCalledWith(
				expect.stringContaining("NOT ("),
				expect.objectContaining({
					p_0: "plug-b",
					i_0: "tid",
					p_1: "plug-a",
					i_1: "id1",
				}),
			);
		});
	});

	describe("removeOrphanedArtists", () => {
		it("builds and executes delete query", async () => {
			const subQb = {
				subQuery: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getQuery: jest.fn().mockReturnValue("SELECT 1"),
			};
			const mainQb = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			(artistsRepo as any).manager = { createQueryBuilder: () => subQb };
			artistsRepo.createQueryBuilder.mockReturnValue(mainQb);

			await service.removeOrphanedArtists();
			expect(mainQb.execute).toHaveBeenCalled();
		});
	});

	describe("forEachArtistId", () => {
		it("calls callback for each artist", async () => {
			const callback = jest.fn();
			artistsRepo.find
				.mockResolvedValueOnce([{ uuid: "a1" }, { uuid: "a2" }])
				.mockResolvedValueOnce([]);

			await service.forEachArtistId(callback);
			expect(callback).toHaveBeenCalledTimes(2);
		});

		it("stops on cancel", async () => {
			const callback = jest.fn((_uuid: string, cancel: () => void) => {
				cancel();
			});
			artistsRepo.find.mockResolvedValue([{ uuid: "a1" }]);

			await service.forEachArtistId(callback);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("fetches multiple chunks until an empty page", async () => {
			const callback = jest.fn();
			const fullPage = Array.from({ length: 1000 }, (_, i) => ({
				uuid: `a${i}`,
			}));
			artistsRepo.find
				.mockResolvedValueOnce(fullPage)
				.mockResolvedValueOnce([{ uuid: "last" }])
				.mockResolvedValue([]);

			await service.forEachArtistId(callback);

			expect(callback).toHaveBeenCalledTimes(1001);
			expect(artistsRepo.find).toHaveBeenLastCalledWith({
				take: 1000,
				skip: 2000,
				relationLoadStrategy: "query",
				select: undefined,
				relations: {
					attributes: undefined,
					identities: undefined,
				},
			});
		});
	});
});
