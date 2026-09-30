import { AlbumsService } from "./albums.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { DisabledIdentifiersService } from "src/identifiers/disabled-identifiers.service";
import { TasksService } from "src/tasks/tasks.service";
import { DataSource } from "typeorm";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";

const makePlugin = (name: string) => ({ package: { name } }) as any;

const makeIdentifier = (
	id: string,
	target: string = "album",
	deps: { pluginId: string | null; sourceId: string }[] = [],
) =>
	({
		id,
		target,
		getDependencies: jest.fn(() => deps),
		identify: jest.fn(),
	}) as any;

const makeIdentityEntry = (overrides: Record<string, unknown> = {}) => {
	const base = {
		pluginId: "plug",
		identifierId: "id1",
		albumUuid: "album-1",
		ordinal: 0,
		identity: "value",
		originalAlbumUuid: null as string | null,
		toIdentity() {
			return {
				identityId: this.identifierId,
				pluginId: this.pluginId,
				identity: this.identity,
			};
		},
	};
	return { ...base, ...overrides };
};

const makeTxRepo = () => ({
	findBy: jest.fn(async () => [] as any[]),
	update: jest.fn(async () => undefined),
	delete: jest.fn(async () => undefined),
	insert: jest.fn(async () => undefined),
	create: jest.fn((data: any) => data),
	save: jest.fn(async (data: any) => data),
});

const createTxManager = () => {
	const albums = makeTxRepo();
	const identities = makeTxRepo();
	const albumTracks = makeTxRepo();
	const albumArtists = makeTxRepo();
	const albumMerges = makeTxRepo();
	const other = makeTxRepo();
	const manager = {
		getRepository: (entity: any) => {
			switch (entity.name) {
				case "DBAlbum":
					return albums;
				case "DBAlbumIdentity":
					return identities;
				case "DBAlbumTrack":
					return albumTracks;
				case "DBAlbumArtist":
					return albumArtists;
				case "DBAlbumMerge":
					return albumMerges;
				default:
					return other;
			}
		},
	};
	return { manager, albums, identities, albumTracks, albumArtists, albumMerges, other };
};

describe("AlbumsService", () => {
	let service: AlbumsService;
	let mockAlbumsRepository: any;
	let mockIdentitiesRepository: any;
	let mockAlbumManagerService: any;
	let mockArtistManagerService: any;
	let mockDisabledIdentifiersService: any;
	let mockTasksService: any;
	let mockDataSource: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockAlbumsRepository = { find: jest.fn() };
		mockIdentitiesRepository = {
			find: jest.fn(),
			findBy: jest.fn(),
			create: jest.fn((data: any) => makeIdentityEntry(data)),
			delete: jest.fn(),
			insert: jest.fn(),
		};
		mockAlbumManagerService = {
			getIdentifiers: jest.fn(),
			setRunId: jest.fn(),
			count: jest.fn(),
			findIdentities: jest.fn(),
			getInformationHelper: jest.fn(),
			clearArtistLinks: jest.fn(),
			setArtistLinks: jest.fn(),
		};
		mockArtistManagerService = {
			findIdentities: jest.fn(),
			resolveArtist: jest.fn(),
		};
		mockDisabledIdentifiersService = {
			getDisabledSet: jest.fn(),
		};
		mockTasksService = {
			registerSystemTask: jest.fn(),
		};
		mockDataSource = { transaction: jest.fn() };

		service = new AlbumsService(
			mockAlbumsRepository as any,
			mockIdentitiesRepository as any,
			mockAlbumManagerService as any,
			mockArtistManagerService as any,
			mockDisabledIdentifiersService as any,
			mockTasksService as any,
			mockDataSource as any,
		);
	});

	describe("constructor", () => {
		it("registers the identify-albums system task", () => {
			expect(mockTasksService.registerSystemTask).toHaveBeenCalledWith(
				expect.objectContaining({ id: "identify-albums" }),
			);
		});
	});

	describe("identifyAlbum", () => {
		it("returns early when no identifiers are registered", async () => {
			mockAlbumManagerService.getIdentifiers.mockReturnValue([]);
			mockAlbumManagerService.setRunId.mockResolvedValue(undefined);

			const album = { uuid: "album-uuid" } as any;
			const result = await service.identifyAlbum(album, "runId");

			expect(mockAlbumManagerService.getIdentifiers).toHaveBeenCalledTimes(1);
			expect(mockAlbumManagerService.setRunId).toHaveBeenCalledWith(album, "runId", "identity");
			expect(result).toEqual({
				identities: [],
				mergedAlbums: [album.uuid],
				splitCount: 0,
			});
		});

		it("stores new identities for an album with a single identifier", async () => {
			const album = { uuid: "album-1", dateAdded: 1000 } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["v1", "v2"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(identifier.identify).toHaveBeenCalledTimes(1);
			expect(tx.albums.update).toHaveBeenCalledWith("album-1", {
				lastIdentificationRunId: "runId",
			});
			expect(tx.identities.delete).toHaveBeenCalledWith([
				{ albumUuid: "album-1", pluginId: "plug", identifierId: "id1" },
				{ albumUuid: "album-1", pluginId: "plug", identifierId: "id1" },
			]);
			expect(tx.identities.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						identity: "v1",
						ordinal: 0,
						originalAlbumUuid: "album-1",
					}),
					expect.objectContaining({
						identity: "v2",
						ordinal: 1,
						originalAlbumUuid: "album-1",
					}),
				]),
			);
			expect(mockAlbumManagerService.setRunId).not.toHaveBeenCalled();
			expect(result).toEqual({
				mergedAlbums: ["album-1"],
				identities: expect.arrayContaining([
					expect.objectContaining({ identity: "v1" }),
					expect.objectContaining({ identity: "v2" }),
				]),
				splitCount: 0,
			});
		});

		it("keeps the original album uuid from previous identities", async () => {
			const album = { uuid: "album-1", dateAdded: 1000 } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["v1", "v2"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				makeIdentityEntry({ identity: "v1", ordinal: 0, originalAlbumUuid: "orig-9" }),
			]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(result.identities).toHaveLength(2);
			expect(result.identities[0]).toEqual(
				expect.objectContaining({ identity: "v1", originalAlbumUuid: "orig-9" }),
			);
			expect(result.identities[1]).toEqual(
				expect.objectContaining({ identity: "v2", originalAlbumUuid: "album-1" }),
			);
			expect(mockAlbumManagerService.findIdentities).toHaveBeenCalledTimes(1);
		});

		it("skips disabled identifiers and clears their data", async () => {
			const album = { uuid: "album-1" } as any;
			const identifier = makeIdentifier("id1");
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);

			const result = await service.identifyAlbum(
				album,
				"runId",
				new Set(["plug:id1:album"]),
			);

			expect(identifier.identify).not.toHaveBeenCalled();
			expect(mockAlbumManagerService.clearArtistLinks).toHaveBeenCalledWith(
				album,
				"plug",
				"id1",
			);
			expect(mockIdentitiesRepository.delete).toHaveBeenCalledWith({
				identifierId: "id1",
				pluginId: "plug",
				albumUuid: "album-1",
			});
			expect(mockAlbumManagerService.setRunId).toHaveBeenCalledWith(album, "runId", "identity");
			expect(result).toEqual({ identities: [], mergedAlbums: ["album-1"], splitCount: 0 });
		});

		it("skips identifiers whose dependencies are disabled", async () => {
			const album = { uuid: "album-1" } as any;
			const idA = makeIdentifier("id-a");
			const idB = makeIdentifier("id-b", "album", [
				{ pluginId: "plug-a", sourceId: "id-a" },
			]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier: idA, plugin: makePlugin("plug-a") },
				{ identifier: idB, plugin: makePlugin("plug-b") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);

			const result = await service.identifyAlbum(
				album,
				"runId",
				new Set(["plug-a:id-a:album"]),
			);

			expect(idA.identify).not.toHaveBeenCalled();
			expect(idB.identify).not.toHaveBeenCalled();
			expect(mockAlbumManagerService.clearArtistLinks).toHaveBeenCalledWith(
				album,
				"plug-a",
				"id-a",
			);
			expect(mockAlbumManagerService.clearArtistLinks).toHaveBeenCalledWith(
				album,
				"plug-b",
				"id-b",
			);
			expect(mockIdentitiesRepository.delete).toHaveBeenCalledTimes(2);
			expect(result.identities).toEqual([]);
		});

		it("continues when an identifier throws", async () => {
			const album = { uuid: "album-1" } as any;
			const id1 = makeIdentifier("id1");
			id1.identify.mockRejectedValue(new Error("boom"));
			const id2 = makeIdentifier("id2");
			id2.identify.mockResolvedValue(["v"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier: id1, plugin: makePlugin("plug") },
				{ identifier: id2, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(id2.identify).toHaveBeenCalledTimes(1);
			expect(result.identities).toHaveLength(1);
			expect(result.mergedAlbums).toEqual(["album-1"]);
			expect(result.splitCount).toBe(0);
		});

		it("resolves and links artists for artist-target identifiers", async () => {
			const album = { uuid: "album-1" } as any;
			const identifier = makeIdentifier("id1", "artist");
			identifier.identify.mockResolvedValue(["art-v1", "art-v2"]);
			mockArtistManagerService.resolveArtist
				.mockResolvedValueOnce("artist-1")
				.mockResolvedValueOnce("artist-2");
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });

			const result = await service.identifyAlbum(album, "runId");

			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plug",
				"id1",
				"art-v1",
				ArtistIdentityTarget.ALBUM,
				true,
			);
			expect(mockAlbumManagerService.setArtistLinks).toHaveBeenCalledWith(
				album,
				["artist-1", "artist-2"],
				"plug",
				"id1",
			);
			expect(mockAlbumManagerService.setRunId).toHaveBeenCalledWith(album, "runId", "identity");
			expect(mockIdentitiesRepository.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ identity: "art-v1", ordinal: 0 }),
					expect.objectContaining({ identity: "art-v2", ordinal: 1 }),
				]),
			);
			expect(result.identities).toHaveLength(2);
			expect(result.mergedAlbums).toEqual(["album-1"]);
			expect(result.splitCount).toBe(0);
		});

		it("clears links and identities when an identifier returns no values", async () => {
			const album = { uuid: "album-1" } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(null);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });

			const result = await service.identifyAlbum(album, "runId");

			expect(mockAlbumManagerService.clearArtistLinks).toHaveBeenCalledWith(
				album,
				"plug",
				"id1",
			);
			expect(mockIdentitiesRepository.delete).toHaveBeenCalledWith({
				identifierId: "id1",
				pluginId: "plug",
				albumUuid: "album-1",
			});
			expect(mockAlbumManagerService.setRunId).toHaveBeenCalledWith(album, "runId", "identity");
			expect(result).toEqual({ identities: [], mergedAlbums: ["album-1"], splitCount: 0 });
			expect(mockDataSource.transaction).not.toHaveBeenCalled();
		});

		it("merges albums that share identities", async () => {
			const album = { uuid: "album-1", dateAdded: "2020-01-02 03:04:05" } as any;
			const otherAlbum = { uuid: "album-2", dateAdded: 1000 } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["v1"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([
				{
					pluginId: "plug",
					identifierId: "id1",
					albumUuid: "album-2",
					ordinal: 0,
					identity: "v1",
					originalAlbumUuid: null,
					album: otherAlbum,
				},
			]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			tx.identities.findBy.mockResolvedValue([
				makeIdentityEntry({
					pluginId: "plug",
					identifierId: "id2",
					identity: "other",
					albumUuid: "album-2",
				}),
			]);
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(result.mergedAlbums).toEqual(["album-2", "album-1"]);
			expect(result.identities).toHaveLength(2);
			expect(result.splitCount).toBe(0);
			expect(tx.albums.delete).toHaveBeenCalledWith({ uuid: expect.anything() });
			expect(tx.albums.update).toHaveBeenCalledWith("album-2", {
				lastIdentificationRunId: "runId",
			});
			expect(tx.albumMerges.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ mergedUuid: "album-1", masterUuid: "album-2" }),
				]),
			);
		});

		it("does not split when merged partitions still share identities", async () => {
			const album = { uuid: "album-1", dateAdded: 1000 } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify.mockResolvedValue(["shared"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				makeIdentityEntry({ identity: "a", ordinal: 0, originalAlbumUuid: null }),
				makeIdentityEntry({ identity: "b", ordinal: 1, originalAlbumUuid: "orig-1" }),
			]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(mockAlbumManagerService.findIdentities).toHaveBeenCalledTimes(1);
			expect(identifier.identify).toHaveBeenCalledTimes(3);
			expect(result.splitCount).toBe(0);
			expect(result.mergedAlbums).toEqual(["album-1"]);
		});

		it("splits off a merged partition with disjoint identities", async () => {
			const album = { uuid: "album-1", dateAdded: 1000 } as any;
			const identifier = makeIdentifier("id1");
			identifier.identify
				.mockResolvedValueOnce(["x"])
				.mockResolvedValueOnce(["y"])
				.mockResolvedValue(["x"]);
			mockAlbumManagerService.getIdentifiers.mockReturnValue([
				{ identifier, plugin: makePlugin("plug") },
			]);
			mockAlbumManagerService.findIdentities.mockResolvedValue([
				makeIdentityEntry({ identity: "a", ordinal: 0, originalAlbumUuid: null }),
				makeIdentityEntry({ identity: "b", ordinal: 1, originalAlbumUuid: "orig-1" }),
			]);
			mockAlbumManagerService.getInformationHelper.mockResolvedValue({ helper: true });
			mockIdentitiesRepository.find.mockResolvedValue([]);
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			const tx = createTxManager();
			mockDataSource.transaction.mockImplementation(async (cb: any) => cb(tx.manager));

			const result = await service.identifyAlbum(album, "runId");

			expect(mockDataSource.transaction).toHaveBeenCalledTimes(2);
			expect(tx.albums.save).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Unknown Album", uuid: "orig-1" }),
			);
			expect(tx.identities.insert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ identity: "b", albumUuid: "orig-1" }),
				]),
			);
			expect(tx.albumMerges.delete).toHaveBeenCalledWith({
				mergedUuid: expect.anything(),
				masterUuid: "album-1",
			});
			expect(mockAlbumManagerService.findIdentities).toHaveBeenCalledTimes(2);
			expect(result.splitCount).toBe(1);
			expect(result.mergedAlbums).toEqual(["album-1"]);
			expect(result.identities).toHaveLength(1);
		});
	});

	describe("identifyAllAlbums", () => {
		it("returns immediately when no albums to identify", async () => {
			mockAlbumManagerService.count.mockResolvedValue(0);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(new Set());

			await service.identifyAllAlbums("runId", true);

			expect(mockAlbumManagerService.count).toHaveBeenCalledTimes(1);
			expect(mockDisabledIdentifiersService.getDisabledSet).not.toHaveBeenCalled();
		});

		it("uses a single criterion when onlyNew is true", async () => {
			mockAlbumManagerService.count.mockResolvedValue(0);

			await service.identifyAllAlbums("runId", true);

			const criteria = mockAlbumManagerService.count.mock.calls[0][0];
			expect(criteria).toHaveLength(1);
		});

		it("uses two criteria when onlyNew is false", async () => {
			mockAlbumManagerService.count.mockResolvedValue(0);

			await service.identifyAllAlbums("runId", false);

			const criteria = mockAlbumManagerService.count.mock.calls[0][0];
			expect(criteria).toHaveLength(2);
		});

		it("identifies each album and reports progress", async () => {
			const album1 = { uuid: "album-1" } as any;
			const album2 = { uuid: "album-2" } as any;
			const disabledSet = new Set(["plug:id1:album"]);
			mockAlbumManagerService.count.mockResolvedValue(2);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(disabledSet);
			mockAlbumsRepository.find.mockResolvedValueOnce([album1, album2]).mockResolvedValue([]);
			const identifySpy = jest
				.spyOn(service, "identifyAlbum")
				.mockImplementation(async (album: any) => ({
					identities: [],
					mergedAlbums: [album.uuid],
					splitCount: 0,
				}));
			const onProgress = jest.fn();

			await service.identifyAllAlbums("runId", true, onProgress);

			expect(identifySpy).toHaveBeenCalledTimes(2);
			expect(identifySpy).toHaveBeenCalledWith(album1, "runId", disabledSet);
			expect(identifySpy).toHaveBeenCalledWith(album2, "runId", disabledSet);
			expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
			expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
			expect(mockAlbumsRepository.find).toHaveBeenCalledTimes(2);
			expect(mockAlbumsRepository.find).toHaveBeenCalledWith(
				expect.objectContaining({ take: 30 }),
			);
		});

		it("resolves when an album fails to identify", async () => {
			const album1 = { uuid: "album-1" } as any;
			mockAlbumManagerService.count.mockResolvedValue(1);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(new Set());
			mockAlbumsRepository.find.mockResolvedValueOnce([album1]).mockResolvedValue([]);
			const identifySpy = jest
				.spyOn(service, "identifyAlbum")
				.mockRejectedValue(new Error("boom"));
			const onProgress = jest.fn();

			await expect(
				service.identifyAllAlbums("runId", true, onProgress),
			).resolves.toBeUndefined();

			expect(identifySpy).toHaveBeenCalledTimes(1);
			expect(onProgress).toHaveBeenCalledWith(1, 1);
		});

		it("reloads chunks after albums are split", async () => {
			const album1 = { uuid: "album-1" } as any;
			const album2 = { uuid: "album-2" } as any;
			mockAlbumManagerService.count.mockResolvedValue(1);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(new Set());
			mockAlbumsRepository.find
				.mockResolvedValueOnce([album1])
				.mockResolvedValueOnce([album2])
				.mockResolvedValue([]);
			const identifySpy = jest
				.spyOn(service, "identifyAlbum")
				.mockImplementation(async (album: any) => ({
					identities: [],
					mergedAlbums: [album.uuid],
					splitCount: album.uuid === "album-1" ? 1 : 0,
				}));
			const onProgress = jest.fn();

			await service.identifyAllAlbums("runId", true, onProgress);

			expect(identifySpy).toHaveBeenCalledTimes(2);
			expect(mockAlbumsRepository.find).toHaveBeenCalledTimes(3);
			expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
			expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
		});
	});
});
