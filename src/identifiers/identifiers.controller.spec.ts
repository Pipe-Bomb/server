import { IdentifiersController } from "./identifiers.controller";
import { IdentifiersService } from "./identifiers.service";
import { BadRequestException } from "@nestjs/common";
import { IdentifierType } from "./enum/identifier-type.enum";

describe("IdentifiersController", () => {
	let controller: IdentifiersController;
	let identifiersService: IdentifiersService;
	let mockDisabledIdentifiersService: any;
	let mockPrivilegesService: any;

	const makeIdentifier = (id: string, target: string) => ({
		id,
		target,
		getDependencies: () => [],
		getSoftDependencies: () => [],
	});
	const makePlugin = (name: string) => ({ package: { name } });

	beforeEach(() => {
		jest.clearAllMocks();
		const mockIdentitiesRepository = {
			upsert: jest.fn(),
			delete: jest.fn(),
			findBy: jest.fn(),
			deleteAll: jest.fn(),
			createQueryBuilder: jest.fn(),
		};
		mockDisabledIdentifiersService = {
			getDisabledSet: jest.fn(),
			disableIdentifiers: jest.fn(),
			enableIdentifiers: jest.fn(),
		};
		const mockArtistManagerService = {
			registerTrackIdentifier: jest.fn(),
			unregisterTrackIdentifier: jest.fn(),
			getIdentifiers: jest.fn(),
		};
		const mockAlbumManagerService = {
			registerTrackIdentifier: jest.fn(),
			unregisterTrackIdentifier: jest.fn(),
			getIdentifiers: jest.fn(),
		};

		identifiersService = new IdentifiersService(
			mockIdentitiesRepository as any,
			mockDisabledIdentifiersService as any,
			mockArtistManagerService as any,
			mockAlbumManagerService as any,
		);
		identifiersService.register(
			makeIdentifier("isrc", "track") as any,
			makePlugin("plug") as any,
		);
		mockArtistManagerService.getIdentifiers.mockReturnValue([
			{
				identifier: makeIdentifier("mbid", "artist"),
				plugin: makePlugin("plug"),
			},
		]);
		mockAlbumManagerService.getIdentifiers.mockReturnValue([]);

		mockPrivilegesService = {
			registerPrivilege: jest.fn(),
		};

		controller = new IdentifiersController(
			identifiersService,
			mockDisabledIdentifiersService,
			mockPrivilegesService,
		);
	});

	it("registers the manage-identifiers privilege", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"manage-identifiers",
		);
	});

	describe("getAll", () => {
		it("returns responses for track, artist and album identifiers with disabled flags", async () => {
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(
				new Set(["plug:mbid:artist"]),
			);

			const result = await controller.getAll();

			expect(result).toEqual([
				{
					pluginId: "plug",
					identifierId: "isrc",
					type: IdentifierType.Track,
					target: "track",
					dependencies: [],
					softDependencies: [],
					disabled: false,
				},
				{
					pluginId: "plug",
					identifierId: "mbid",
					type: IdentifierType.Artist,
					target: "artist",
					dependencies: [],
					softDependencies: [],
					disabled: true,
				},
			]);
		});
	});

	describe("updateIdentifiers", () => {
		it("rejects updates that reference unknown identifiers", async () => {
			await expect(
				controller.updateIdentifiers({
					enable: [],
					disable: [{ pluginId: "plug", identifierId: "nope", type: "track" }],
				} as any),
			).rejects.toThrow(BadRequestException);
			expect(mockDisabledIdentifiersService.disableIdentifiers).not.toHaveBeenCalled();
		});

		it("disables and enables identifiers and returns the updated list", async () => {
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(
				new Set(["plug:isrc:track"]),
			);

			const result = await controller.updateIdentifiers({
				enable: [
					{ pluginId: "plug", identifierId: "mbid", type: "artist" },
				],
				disable: [{ pluginId: "plug", identifierId: "isrc", type: "track" }],
			} as any);

			expect(mockDisabledIdentifiersService.disableIdentifiers).toHaveBeenCalledWith([
				{ pluginId: "plug", identifierId: "isrc", type: "track" },
			]);
			expect(mockDisabledIdentifiersService.enableIdentifiers).toHaveBeenCalledWith([
				{ pluginId: "plug", identifierId: "mbid", type: "artist" },
			]);
			expect(result).toHaveLength(2);
			const isrc = result.find((r) => r.identifierId === "isrc")!;
			expect(isrc.disabled).toBe(true);
		});
	});
});
