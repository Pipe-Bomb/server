import { IdentifiersService } from "./identifiers.service";
import { IdentifierType } from "./enum/identifier-type.enum";
import { DeregistrationBlockedError } from "src/util/deregistration-blocked.error";

describe("IdentifiersService", () => {
	let service: IdentifiersService;
	let mockIdentitiesRepository: any;
	let mockDisabledIdentifiersService: any;
	let mockArtistManagerService: any;
	let mockAlbumManagerService: any;

	const makeIdentifier = (id: string, overrides: any = {}) => ({
		id,
		target: "track",
		getDependencies: () => [],
		getSoftDependencies: () => [],
		...overrides,
	});
	const makePlugin = (name: string) => ({ package: { name } });

	beforeEach(() => {
		jest.clearAllMocks();
		mockIdentitiesRepository = {
			upsert: jest.fn(),
			delete: jest.fn(),
			findBy: jest.fn(),
			deleteAll: jest.fn(),
			createQueryBuilder: jest.fn(),
		};
		mockDisabledIdentifiersService = {
			getDisabledSet: jest.fn(),
		};
		mockArtistManagerService = {
			registerTrackIdentifier: jest.fn(),
			unregisterTrackIdentifier: jest.fn(),
			resolveArtist: jest.fn(),
			setTrackLinks: jest.fn(),
			clearTrackLinks: jest.fn(),
			getIdentifiers: jest.fn(),
		};
		mockAlbumManagerService = {
			registerTrackIdentifier: jest.fn(),
			unregisterTrackIdentifier: jest.fn(),
			resolveAlbum: jest.fn(),
			setTrackLinks: jest.fn(),
			clearTrackLinks: jest.fn(),
			getIdentifiers: jest.fn(),
		};

		service = new IdentifiersService(
			mockIdentitiesRepository as any,
			mockDisabledIdentifiersService as any,
			mockArtistManagerService as any,
			mockAlbumManagerService as any,
		);
	});

	describe("register", () => {
		it("stores the identifier and exposes it through all()", () => {
			const identifier = makeIdentifier("isrc");
			const plugin = makePlugin("plug");

			service.register(identifier as any, plugin as any);

			expect(service.all()).toEqual([
				expect.objectContaining({ identifier, plugin }),
			]);
		});

		it("notifies the artist and album managers based on the target", () => {
			service.register(
				makeIdentifier("a", { target: "artist" }) as any,
				makePlugin("p1") as any,
			);
			expect(mockArtistManagerService.registerTrackIdentifier).toHaveBeenCalledTimes(1);
			expect(mockAlbumManagerService.registerTrackIdentifier).not.toHaveBeenCalled();

			service.register(
				makeIdentifier("b", { target: "album" }) as any,
				makePlugin("p2") as any,
			);
			expect(mockAlbumManagerService.registerTrackIdentifier).toHaveBeenCalledTimes(1);
		});

		it("throws when the same plugin registers the same identifier twice", () => {
			const plugin = makePlugin("plug");

			service.register(makeIdentifier("id") as any, plugin as any);

			expect(() =>
				service.register(makeIdentifier("id") as any, plugin as any),
			).toThrow(/already registered/);
		});
	});

	describe("unregister", () => {
		it("is a no-op for an unknown identifier", () => {
			service.unregister(makeIdentifier("id") as any, makePlugin("plug") as any);

			expect(service.all()).toEqual([]);
		});

		it("removes the identifier from the registry", () => {
			service.register(makeIdentifier("id") as any, makePlugin("plug") as any);

			service.unregister(makeIdentifier("id") as any, makePlugin("plug") as any);

			expect(service.all()).toEqual([]);
		});

		it("throws when another identifier depends on the one being removed", () => {
			const dependent = makeIdentifier("dep", {
				getDependencies: () => [{ pluginId: "plug", sourceId: "target" }],
			});
			service.register(dependent as any, makePlugin("other") as any);
			service.register(makeIdentifier("target") as any, makePlugin("plug") as any);

			expect(() =>
				service.unregister(makeIdentifier("target") as any, makePlugin("plug") as any),
			).toThrow(DeregistrationBlockedError);
		});

		it("notifies the artist manager when unregistering an artist target", () => {
			service.register(
				makeIdentifier("id", { target: "artist" }) as any,
				makePlugin("plug") as any,
			);

			service.unregister(
				makeIdentifier("id", { target: "artist" }) as any,
				makePlugin("plug") as any,
			);

			expect(mockArtistManagerService.unregisterTrackIdentifier).toHaveBeenCalledTimes(1);
			expect(mockAlbumManagerService.unregisterTrackIdentifier).not.toHaveBeenCalled();
		});
	});

	describe("identifyTrack", () => {
		const track = { uuid: "track-uuid", trackId: "t1" } as any;
		const makeLibrary = () =>
			({
				handler: { id: "lib" },
				informationHelper: jest.fn().mockResolvedValue({ helper: true }),
			}) as any;

		it("upserts identities returned by the identifier", async () => {
			const identifier = makeIdentifier("isrc", {
				identify: jest.fn().mockResolvedValue(["USABC123"]),
			});
			service.register(identifier as any, makePlugin("plug") as any);

			await service.identifyTrack(track, makeLibrary());

			expect(identifier.identify).toHaveBeenCalledWith(
				{ helper: true },
				expect.anything(),
			);
			expect(mockIdentitiesRepository.upsert).toHaveBeenCalledWith(
				[
					{
						identifierId: "isrc",
						pluginId: "plug",
						trackUuid: "track-uuid",
						identity: "USABC123",
						ordinal: 0,
					},
				],
				{
					conflictPaths: ["pluginId", "identifierId", "trackUuid", "ordinal"],
				},
			);
			expect(mockIdentitiesRepository.delete).not.toHaveBeenCalled();
		});

		it("resolves and links artists for artist-target identifiers", async () => {
			const identifier = makeIdentifier("artist-id", {
				target: "artist",
				identify: jest.fn().mockResolvedValue(["artist-1"]),
			});
			service.register(identifier as any, makePlugin("plug") as any);
			mockArtistManagerService.resolveArtist.mockResolvedValue("resolved-uuid");

			await service.identifyTrack(track, makeLibrary());

			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plug",
				"artist-id",
				"artist-1",
				expect.any(String),
				true,
			);
			expect(mockArtistManagerService.setTrackLinks).toHaveBeenCalledWith(
				track,
				["resolved-uuid"],
				"plug",
				"artist-id",
			);
		});

		it("clears links and deletes identities when the identifier returns nothing", async () => {
			const identifier = makeIdentifier("isrc", {
				identify: jest.fn().mockResolvedValue([]),
			});
			service.register(identifier as any, makePlugin("plug") as any);

			await service.identifyTrack(track, makeLibrary());

			expect(mockIdentitiesRepository.upsert).not.toHaveBeenCalled();
			expect(mockArtistManagerService.clearTrackLinks).toHaveBeenCalledWith(
				track,
				"plug",
				"isrc",
			);
			expect(mockAlbumManagerService.clearTrackLinks).toHaveBeenCalledWith(
				track,
				"plug",
				"isrc",
			);
			expect(mockIdentitiesRepository.delete).toHaveBeenCalledWith({
				identifierId: "isrc",
				pluginId: "plug",
				trackUuid: "track-uuid",
			});
		});

		it("skips identifiers whose key is in the disabled set", async () => {
			const identifier = makeIdentifier("isrc", {
				identify: jest.fn(),
			});
			service.register(identifier as any, makePlugin("plug") as any);

			await service.identifyTrack(track, makeLibrary(), new Set(["plug:isrc:track"]));

			expect(identifier.identify).not.toHaveBeenCalled();
			expect(mockIdentitiesRepository.delete).toHaveBeenCalled();
		});

		it("continues with the remaining identifiers when one throws", async () => {
			const failing = makeIdentifier("bad", {
				identify: jest.fn().mockRejectedValue(new Error("boom")),
			});
			const working = makeIdentifier("good", {
				identify: jest.fn().mockResolvedValue(["v"]),
			});
			service.register(failing as any, makePlugin("p1") as any);
			service.register(working as any, makePlugin("p2") as any);

			await service.identifyTrack(track, makeLibrary());

			expect(mockIdentitiesRepository.upsert).toHaveBeenCalledWith(
				[
					{
						identifierId: "good",
						pluginId: "p2",
						trackUuid: "track-uuid",
						identity: "v",
						ordinal: 0,
					},
				],
				expect.anything(),
			);
		});
	});

	describe("identifyTrackWithIdentity", () => {
		it("throws when the identifier is not registered", async () => {
			await expect(
				service.identifyTrackWithIdentity(
					{ uuid: "track-uuid" } as any,
					{ pluginId: "plug", identityId: "missing", identity: "v" } as any,
				),
			).rejects.toThrow("Identifier does not exist");
		});

		it("upserts the identity for a registered identifier", async () => {
			service.register(makeIdentifier("isrc") as any, makePlugin("plug") as any);

			await service.identifyTrackWithIdentity(
				{ uuid: "track-uuid" } as any,
				{ pluginId: "plug", identityId: "isrc", identity: "v" } as any,
			);

			expect(mockIdentitiesRepository.upsert).toHaveBeenCalledWith(
				{
					pluginId: "plug",
					identifierId: "isrc",
					identity: "v",
					trackUuid: "track-uuid",
					ordinal: 0,
				},
				{
					conflictPaths: ["pluginId", "identifierId", "trackUuid", "ordinal"],
				},
			);
		});
	});

	describe("getDisabledSet", () => {
		it("delegates to the disabled identifiers service", async () => {
			const disabled = new Set(["a"]);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(disabled);

			await expect(service.getDisabledSet()).resolves.toBe(disabled);
		});
	});

	describe("getTrackIdentities", () => {
		it("finds identities by track uuid", async () => {
			const identities = [{ id: 1 }];
			mockIdentitiesRepository.findBy.mockResolvedValue(identities);

			await expect(
				service.getTrackIdentities({ uuid: "track-uuid" } as any),
			).resolves.toBe(identities);
			expect(mockIdentitiesRepository.findBy).toHaveBeenCalledWith({
				trackUuid: "track-uuid",
			});
		});
	});

	describe("getTrackIdentity", () => {
		it("omits the plugin id when it is null", async () => {
			mockIdentitiesRepository.findBy.mockResolvedValue([]);

			await service.getTrackIdentity({ uuid: "track-uuid" } as any, "isrc", null);

			expect(mockIdentitiesRepository.findBy).toHaveBeenCalledWith({
				trackUuid: "track-uuid",
				identifierId: "isrc",
				pluginId: undefined,
			});
		});
	});

	describe("clean", () => {
		it("deletes all identities when no identifiers are registered", async () => {
			await service.clean();

			expect(mockIdentitiesRepository.deleteAll).toHaveBeenCalledTimes(1);
		});

		it("deletes identities that do not match any registered identifier", async () => {
			const queryBuilder = {
				delete: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			mockIdentitiesRepository.createQueryBuilder.mockReturnValue(queryBuilder);

			service.register(makeIdentifier("isrc") as any, makePlugin("plug") as any);

			await service.clean();

			expect(queryBuilder.where).toHaveBeenCalledWith(
				"NOT ((pluginId = :p_0 AND identifierId = :i_0))",
				{ p_0: "plug", i_0: "isrc" },
			);
			await expect(queryBuilder.execute()).resolves.toBeUndefined();
		});
	});

	describe("toResponse", () => {
		it("maps a loaded identifier to its response shape", () => {
			const identifier = makeIdentifier("isrc", {
				getDependencies: () => [{ pluginId: null, sourceId: "lib" }],
			});
			const plugin = makePlugin("plug");

			const result = service.toResponse(
				{ identifier: identifier as any, plugin: plugin as any },
				IdentifierType.Track,
				true,
			);

			expect(result).toEqual({
				pluginId: "plug",
				identifierId: "isrc",
				type: IdentifierType.Track,
				target: "track",
				dependencies: [{ pluginId: null, sourceId: "lib" }],
				softDependencies: [],
				disabled: true,
			});
		});

		it("defaults target to null when the identifier has none", () => {
			const identifier = {
				id: "isrc",
				getDependencies: () => [],
				getSoftDependencies: () => [],
			};
			const plugin = makePlugin("plug");

			const result = service.toResponse(
				{ identifier: identifier as any, plugin: plugin as any },
				IdentifierType.Track,
				false,
			);

			expect(result.target).toBeNull();
		});
	});
});
