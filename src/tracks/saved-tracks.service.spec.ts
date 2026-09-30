import { SavedTracksService } from "./saved-tracks.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DBTrack } from "./entities/track.entity";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
	uuid: "user-1",
	...overrides,
});

describe("SavedTracksService", () => {
	let service: SavedTracksService;
	let mockRepository: any;
	let mockTrackManagerService: any;
	let mockEphemeralService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockRepository = {
			upsert: jest.fn(async () => undefined),
			findOneBy: jest.fn(async () => null),
			delete: jest.fn(async () => undefined),
			findAndCount: jest.fn(async () => [[], 0]),
		};
		mockTrackManagerService = {
			findOne: jest.fn(async () => null),
		};
		mockEphemeralService = {
			find: jest.fn(),
			createTracks: jest.fn(),
		};

		service = new SavedTracksService(
			mockRepository,
			mockTrackManagerService,
			mockEphemeralService,
		);
	});

	describe("saveTrack", () => {
		it("should upsert a saved track", async () => {
			const track = { uuid: "track-1" } as DBTrack;
			const user = makeUser();

			await service.saveTrack(track, user);

			expect(mockRepository.upsert).toHaveBeenCalledWith(
				{ trackUuid: "track-1", userUuid: "user-1" },
				["trackUuid", "userUuid"],
			);
		});
	});

	describe("unsaveTrack", () => {
		it("should throw if track isn't saved", async () => {
			mockRepository.findOneBy.mockResolvedValue(null);
			const track = { uuid: "track-1" } as DBTrack;
			const user = makeUser();

			await expect(
				service.unsaveTrack(track, user),
			).rejects.toThrow(BadRequestException);
		});

		it("should delete a saved track", async () => {
			mockRepository.findOneBy.mockResolvedValue({});
			const track = { uuid: "track-1" } as DBTrack;
			const user = makeUser();

			await service.unsaveTrack(track, user);

			expect(mockRepository.delete).toHaveBeenCalledWith({
				trackUuid: "track-1",
				userUuid: "user-1",
			});
		});
	});

	describe("getSavedTracks", () => {
		it("should return paginated saved tracks for a user", async () => {
			const user = makeUser();
			const tracks = [{ trackUuid: "track-1", track: { uuid: "track-1" } }];
			mockRepository.findAndCount.mockResolvedValue([tracks, 1]);

			const result = await service.getSavedTracks(user, {
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
			expect(result.tracks).toHaveLength(1);
			expect(result.count).toBe(1);
		});

		it("should return all tracks when user is null", async () => {
			mockRepository.findAndCount.mockResolvedValue([[], 0]);

			await service.getSavedTracks(null, { amount: 10 });

			expect(mockRepository.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {},
				}),
			);
		});
	});

	describe("saveEphemeralTrack", () => {
		it("should return null if track already exists", async () => {
			const track = { uuid: "track-1" } as DBTrack;
			mockTrackManagerService.findOne.mockResolvedValue(track);

			const result = await service.saveEphemeralTrack(
				"plug",
				"lib",
				"track-1",
				makeUser(),
			);

			expect(result).toBeNull();
			expect(mockRepository.upsert).toHaveBeenCalledWith(
				{ trackUuid: "track-1", userUuid: "user-1" },
				["trackUuid", "userUuid"],
			);
		});

		it("should throw if source does not exist", async () => {
			mockTrackManagerService.findOne.mockResolvedValue(null);
			mockEphemeralService.find.mockReturnValue(null);

			await expect(
				service.saveEphemeralTrack("plug", "lib", "track-1", makeUser()),
			).rejects.toThrow(NotFoundException);
		});

		it("should create track and return session uuid", async () => {
			const sessionUuid = "session-1";
			mockTrackManagerService.findOne.mockResolvedValue(null);
			mockEphemeralService.find.mockReturnValue({});
			mockEphemeralService.createTracks.mockResolvedValue({
				uuid: sessionUuid,
				promise: Promise.resolve([{} as DBTrack]),
			});

			const result = await service.saveEphemeralTrack(
				"plug",
				"lib",
				"track-1",
				makeUser(),
			);

			expect(result).toBe(sessionUuid);
			expect(mockEphemeralService.createTracks).toHaveBeenCalledWith(
				[{ pluginId: "plug", libraryId: "lib", trackId: "track-1" }],
				{ userUuid: "user-1" },
			);
		});
	});
});
