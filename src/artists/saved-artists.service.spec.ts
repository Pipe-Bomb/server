import { SavedArtistsService } from "./saved-artists.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
	uuid: "user-1",
	...overrides,
});

describe("SavedArtistsService", () => {
	let service: SavedArtistsService;
	let mockRepository: any;
	let mockArtistManagerService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockRepository = {
			upsert: jest.fn(async () => undefined),
			findOneBy: jest.fn(async () => null),
			delete: jest.fn(async () => undefined),
			findAndCount: jest.fn(async () => [[], 0]),
		};
		mockArtistManagerService = {
			resolveArtist: jest.fn(),
			findOne: jest.fn(),
		};

		service = new SavedArtistsService(
			mockRepository,
			mockArtistManagerService,
		);
	});

	describe("saveArtist", () => {
		it("should upsert a saved artist", async () => {
			const artist = { uuid: "artist-1" } as DBArtist;
			const user = makeUser();

			await service.saveArtist(artist, user);

			expect(mockRepository.upsert).toHaveBeenCalledWith(
				{ artistUuid: "artist-1", userUuid: "user-1" },
				["artistUuid", "userUuid"],
			);
		});
	});

	describe("unsaveArtist", () => {
		it("should throw if artist isn't saved", async () => {
			mockRepository.findOneBy.mockResolvedValue(null);
			const artist = { uuid: "artist-1" } as DBArtist;
			const user = makeUser();

			await expect(
				service.unsaveArtist(artist, user),
			).rejects.toThrow(BadRequestException);
		});

		it("should delete a saved artist", async () => {
			mockRepository.findOneBy.mockResolvedValue({});
			const artist = { uuid: "artist-1" } as DBArtist;
			const user = makeUser();

			await service.unsaveArtist(artist, user);

			expect(mockRepository.delete).toHaveBeenCalledWith({
				artistUuid: "artist-1",
				userUuid: "user-1",
			});
		});
	});

	describe("getSavedArtists", () => {
		it("should return paginated saved artists for a user", async () => {
			const user = makeUser();
			const artists = [{ artistUuid: "artist-1", artist: { uuid: "artist-1" } }];
			mockRepository.findAndCount.mockResolvedValue([artists, 1]);

			const result = await service.getSavedArtists(user, {
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
			expect(result.artists).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it("should return all artists when user is null", async () => {
			mockRepository.findAndCount.mockResolvedValue([[], 0]);

			await service.getSavedArtists(null, { amount: 10 });

			expect(mockRepository.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {},
				}),
			);
		});
	});

	describe("saveEphemeralArtist", () => {
		it("should throw if artist not found after resolve", async () => {
			mockArtistManagerService.resolveArtist.mockResolvedValue("artist-1");
			mockArtistManagerService.findOne.mockResolvedValue(null);

			await expect(
				service.saveEphemeralArtist("plug", "id1", "artist-id", makeUser()),
			).rejects.toThrow(NotFoundException);
		});

		it("should resolve and save artist", async () => {
			const artist = { uuid: "artist-1" } as DBArtist;
			mockArtistManagerService.resolveArtist.mockResolvedValue("artist-1");
			mockArtistManagerService.findOne.mockResolvedValue(artist);

			await service.saveEphemeralArtist(
				"plug",
				"id1",
				"artist-id",
				makeUser(),
			);

			expect(mockArtistManagerService.resolveArtist).toHaveBeenCalledWith(
				"plug",
				"id1",
				"artist-id",
				ArtistIdentityTarget.ARTIST,
				true,
			);
			expect(mockRepository.upsert).toHaveBeenCalledWith(
				{ artistUuid: "artist-1", userUuid: "user-1" },
				["artistUuid", "userUuid"],
			);
		});
	});
});
