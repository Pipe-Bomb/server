jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

import { TracksController } from "./tracks.controller";
import { NotFoundException } from "@nestjs/common";


describe("TracksController", () => {
	let controller: TracksController;
	let mockTracksService: any;
	let mockTrackManagerService: any;
	let mockLibrariesService: any;
	let mockIdentifiersService: any;
	let mockAudioSessionsService: any;
	let mockEphemeralService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockTracksService = { getExternalUrls: jest.fn() };
		mockTrackManagerService = {
			findOne: jest.fn(),
			find: jest.fn(),
		};
		mockLibrariesService = { findLibrary: jest.fn() };
		mockIdentifiersService = { getTrackIdentities: jest.fn() };
		mockAudioSessionsService = { createSession: jest.fn() };
		mockEphemeralService = {
			find: jest.fn(),
			resolveTracks: jest.fn(),
			getAttributeSource: jest.fn(),
			toTracksResponse: jest.fn(),
		};

		controller = new TracksController(
			mockTracksService,
			mockTrackManagerService,
			mockLibrariesService,
			mockIdentifiersService,
			mockAudioSessionsService,
			mockEphemeralService,
		);
	});

	describe("findOne", () => {
		it("returns track response when track is found", async () => {
			const mockTrack = {
				toResponse: () => ({ id: "track-1" }),
			};
			mockTrackManagerService.findOne.mockResolvedValue(mockTrack);

			const result = await controller.findOne("plugin", "lib", "track");

			expect(mockTrackManagerService.findOne).toHaveBeenCalledWith({
				where: { pluginId: "plugin", libraryId: "lib", trackId: "track" },
				relationLoadStrategy: "query",
				relations: expect.objectContaining({
					attributes: true,
					identities: true,
					artists: { artist: { attributes: true } },
					albums: { album: { attributes: true } },
				}),
			});
			expect(result).toEqual({ id: "track-1" });
		});

		it("throws NotFoundException when track and source not found", async () => {
			mockTrackManagerService.findOne.mockResolvedValue(null);
			mockEphemeralService.find.mockReturnValue(null);

			await expect(
				controller.findOne("plugin", "lib", "track"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getExternalUrls", () => {
		it("returns external URLs when track is found", async () => {
			const mockTrack = {
				toResponse: () => ({ id: "track-1" }),
			};
			mockTrackManagerService.findOne.mockResolvedValue(mockTrack);
			const urls = [{ url: "http://a", name: "a", iconUrl: null }];
			mockTracksService.getExternalUrls.mockReturnValue(urls);

			const result = await controller.getExternalUrls(
				"plugin",
				"lib",
				"track",
		); 

			expect(mockTrackManagerService.findOne).toHaveBeenCalledWith({
				where: { pluginId: "plugin", libraryId: "lib", trackId: "track" },
		});
			expect(mockTracksService.getExternalUrls).toHaveBeenCalledWith(mockTrack);
			expect(result).toBe(urls);
		});

		it("returns empty array when track not found", async () => {
			mockTrackManagerService.findOne.mockResolvedValue(null);

			const result = await controller.getExternalUrls(
				"plugin",
				"lib",
				"track",
		); 

			expect(result).toEqual([]);
			expect(mockTracksService.getExternalUrls).not.toHaveBeenCalled();
		});
	});

	describe("getIdentities", () => {
		it("returns identity responses for a track", async () => {
			const mockTrack = { toResponse: () => ({}) };
			mockTrackManagerService.findOne.mockResolvedValue(mockTrack);
			const identity1 = { toResponse: () => ({ id: "id1" }) };
			const identity2 = { toResponse: () => ({ id: "id2" }) };
			mockIdentifiersService.getTrackIdentities.mockResolvedValue([
				identity1,
				identity2,
			]);

			const result = await controller.getIdentities(
				"plugin",
				"lib",
				"track",
			);

			expect(result).toEqual([
				{ id: "id1" },
				{ id: "id2" },
			]);
		});

		it("throws NotFoundException when track not found", async () => {
			mockTrackManagerService.findOne.mockResolvedValue(null);

			await expect(
				controller.getIdentities("plugin", "lib", "track"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getAudioInfo", () => {
		it("returns session response when library exists", async () => {
			const mockLibrary = { id: "lib" };
			mockLibrariesService.findLibrary.mockReturnValue(mockLibrary);
			const mockSession = { toResponse: () => ({ id: "sess" }) };
			mockAudioSessionsService.createSession.mockResolvedValue(mockSession);

			const result = await controller.getAudioInfo(
				"plugin",
				"lib",
				"track",
			);

			expect(mockLibrariesService.findLibrary).toHaveBeenCalledWith(
				"plugin",
				"lib",
			);
			expect(mockAudioSessionsService.createSession).toHaveBeenCalledWith(
				"plugin",
				"lib",
				"track",
			);
			expect(result).toEqual({ id: "sess" });
		});

		it("throws NotFoundException when library not found", async () => {
			mockLibrariesService.findLibrary.mockReturnValue(null);

			await expect(
				controller.getAudioInfo("plugin", "lib", "track"),
			).rejects.toThrow(NotFoundException);
		});
	});
});