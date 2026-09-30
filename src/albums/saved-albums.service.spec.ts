jest.mock("src/libraries/libraries.service", () => ({
	LibrariesService: jest.fn(),
}));

import { SavedAlbumsService } from "./saved-albums.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DBSavedAlbum } from "./entity/saved-album.entity";
import { DBTrack } from "src/tracks/entities/track.entity";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
	uuid: "user-1",
	...overrides,
});

const makeEphemeralTrack = (
	overrides: Record<string, unknown> = {},
) => ({
	pluginId: "plug",
	libraryId: "lib",
	trackId: "track-1",
	...overrides,
});

describe("SavedAlbumsService", () => {
	let service: SavedAlbumsService;
	let mockRepository: any;
	let mockEphemeralService: any;
	let mockLibrariesService: any;
	let mockAlbumManagerService: any;
	let mockAlbumsService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockRepository = {
			find: jest.fn(async () => []),
			findOne: jest.fn(async () => null),
			findOneBy: jest.fn(async () => null),
			upsert: jest.fn(async () => undefined),
			delete: jest.fn(async () => undefined),
			count: jest.fn(async () => 0),
			findAndCount: jest.fn(async () => [[], 0]),
		};
		mockEphemeralService = {
			getEphemeralSourceByAlbumIdentity: jest.fn(),
			resolveEphemeralAlbum: jest.fn(),
			getEphemeralAlbumContent: jest.fn(),
			createTracks: jest.fn(),
		};
		mockLibrariesService = {
			resolveTracks: jest.fn(async () => []),
		};
		mockAlbumManagerService = {
			resolveAlbum: jest.fn(),
			setTrackLinks: jest.fn(async () => undefined),
			setArtistLinks: jest.fn(async () => undefined),
			setJoinPhrase: jest.fn(async () => undefined),
			findOne: jest.fn(async () => null),
		};
		mockAlbumsService = {};

		service = new SavedAlbumsService(
			mockRepository,
			mockEphemeralService,
			mockLibrariesService,
			mockAlbumManagerService,
			mockAlbumsService,
		);
	});

	describe("saveAlbum", () => {
		it("should upsert a saved album", async () => {
			const album = { uuid: "album-1" } as any;
			const user = makeUser();

			await service.saveAlbum(album, user);

			expect(mockRepository.upsert).toHaveBeenCalledWith(
				{ albumUuid: "album-1", userUuid: "user-1" },
				["albumUuid", "userUuid"],
			);
		});
	});

	describe("unsaveAlbum", () => {
		it("should throw if album isn't saved", async () => {
			mockRepository.findOneBy.mockResolvedValue(null);
			const album = { uuid: "album-1" } as any;
			const user = makeUser();

			await expect(
				service.unsaveAlbum(album, user),
			).rejects.toThrow(BadRequestException);
		});

		it("should delete a saved album", async () => {
			mockRepository.findOneBy.mockResolvedValue({});
			const album = { uuid: "album-1" } as any;
			const user = makeUser();

			await service.unsaveAlbum(album, user);

			expect(mockRepository.delete).toHaveBeenCalledWith({
				albumUuid: "album-1",
				userUuid: "user-1",
			});
		});
	});

	describe("getSavedAlbums", () => {
		it("should return paginated saved albums", async () => {
			const user = makeUser();
			const albums = [
				{ albumUuid: "album-1", album: { uuid: "album-1" } },
			];

			mockRepository.findAndCount.mockResolvedValue([albums, 1]);

			const result = await service.getSavedAlbums(user, {
				amount: 10,
				offset: 0,
			});

			expect(mockRepository.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userUuid: "user-1" },
					take: 10,
					skip: 0,
				}),
			);
			expect(result.albums).toHaveLength(1);
			expect(result.count).toBe(1);
		});
	});

	describe("saveEphemeralAlbum", () => {
		it("should throw if source does not exist", async () => {
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue(
				null,
			);

			await expect(
				service.saveEphemeralAlbum("plug", "id1", "album-id", makeUser()),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw if album not found", async () => {
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue({});
			mockEphemeralService.resolveEphemeralAlbum.mockResolvedValue(null);

			await expect(
				service.saveEphemeralAlbum("plug", "id1", "album-id", makeUser()),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw if album has no tracks", async () => {
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue({});
			mockEphemeralService.resolveEphemeralAlbum.mockResolvedValue({
				artists: [],
			});
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue(null);

			await expect(
				service.saveEphemeralAlbum("plug", "id1", "album-id", makeUser()),
			).rejects.toThrow(BadRequestException);
		});

		it("should create tracks and return session uuid", async () => {
			const sessionUuid = "session-1";
			mockEphemeralService.getEphemeralSourceByAlbumIdentity.mockReturnValue({});
			mockEphemeralService.resolveEphemeralAlbum.mockResolvedValue({
				artists: [],
			});
			mockEphemeralService.getEphemeralAlbumContent.mockResolvedValue({
				tracks: [makeEphemeralTrack()],
			});
			mockAlbumManagerService.resolveAlbum.mockResolvedValue("album-1");
			mockLibrariesService.resolveTracks.mockResolvedValue([null]);
			mockEphemeralService.createTracks.mockResolvedValue({
				uuid: sessionUuid,
				promise: Promise.resolve([{} as DBTrack]),
			});

			const result = await service.saveEphemeralAlbum(
				"plug",
				"id1",
				"album-id",
				makeUser(),
			);

			expect(result).toBe(sessionUuid);
			expect(mockEphemeralService.createTracks).toHaveBeenCalledWith(
				[
					{
						pluginId: "plug",
						libraryId: "lib",
						trackId: "track-1",
					},
				],
				{ userUuid: "user-1" },
			);
		});
	});
});
