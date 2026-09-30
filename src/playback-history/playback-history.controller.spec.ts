import { NotFoundException } from "@nestjs/common";
import { PlaybackHistoryController } from "./playback-history.controller";

describe("PlaybackHistoryController", () => {
	let controller: PlaybackHistoryController;
	let mockPlaybackHistoryService: {
		getUserHistory: jest.Mock;
		addHistoryEntry: jest.Mock;
	};
	let mockTrackManagerService: {
		find: jest.Mock;
		findOne: jest.Mock;
	};

	beforeEach(() => {
		mockPlaybackHistoryService = {
			getUserHistory: jest.fn(),
			addHistoryEntry: jest.fn(),
		};
		mockTrackManagerService = {
			find: jest.fn(),
			findOne: jest.fn(),
		};
		controller = new PlaybackHistoryController(
			mockPlaybackHistoryService as any,
			mockTrackManagerService as any,
		);
	});

	describe("getOwnPlaybackHistory", () => {
		it("returns entries with track data", async () => {
			mockPlaybackHistoryService.getUserHistory.mockResolvedValue({
				entries: [
					{
						trackUuid: "t1",
						pluginId: null,
						clientName: "app",
						datePlayed: 1000,
						dateRecorded: 2000,
					},
				],
				total: 1,
			});
			mockTrackManagerService.find.mockResolvedValue([
				{
					uuid: "t1",
					toResponse: () => ({ uuid: "t1" }),
				},
			]);

			const result = await controller.getOwnPlaybackHistory(
				{ sub: "user1" } as any,
				{ pageSize: 10, page: 1 } as any,
			);

			expect(result.total).toBe(1);
			expect(result.entries[0].track).toEqual({ uuid: "t1" });
		});

		it("passes null pluginId when empty string", async () => {
			mockPlaybackHistoryService.getUserHistory.mockResolvedValue({
				entries: [],
				total: 0,
			});
			mockTrackManagerService.find.mockResolvedValue([]);

			await controller.getOwnPlaybackHistory(
				{ sub: "user1" } as any,
				{ pageSize: 10, page: 1, pluginId: "" } as any,
			);

			const call =
				mockPlaybackHistoryService.getUserHistory.mock.calls[0][1];
			expect(call.pluginId).toBeNull();
		});
	});

	describe("reportPlayback", () => {
		it("throws NotFoundException when track not found", async () => {
			mockTrackManagerService.findOne.mockResolvedValue(null);

			await expect(
				controller.reportPlayback(
					{ sub: "user1" } as any,
					{
						pluginId: "p1",
						libraryId: "lib1",
						trackId: "t1",
						clientName: "app",
					} as any,
				),
			).rejects.toThrow(NotFoundException);
		});

		it("adds history entry for found track", async () => {
			mockTrackManagerService.findOne.mockResolvedValue({
				uuid: "track-uuid",
			});

			await controller.reportPlayback(
				{ sub: "user1" } as any,
				{
					pluginId: "p1",
					libraryId: "lib1",
					trackId: "t1",
					clientName: "app",
				} as any,
			);

			expect(mockPlaybackHistoryService.addHistoryEntry).toHaveBeenCalledWith(
				"track-uuid",
				"user1",
				null,
				"app",
				expect.any(Date),
			);
		});
	});
});
