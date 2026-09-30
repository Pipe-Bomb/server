import {
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AudioSessionsService } from "./audio-sessions.service";

jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

describe("AudioSessionsService", () => {
	let service: AudioSessionsService;
	let mockLibrariesService: { findLibrary: jest.Mock };
	let mockStreamingCoreService: { createStreamInstance: jest.Mock };
	let mockAudioCacheService: { getAudioProducer: jest.Mock };

	beforeEach(() => {
		mockLibrariesService = { findLibrary: jest.fn() };
		mockStreamingCoreService = { createStreamInstance: jest.fn() };
		mockAudioCacheService = { getAudioProducer: jest.fn() };

		service = new AudioSessionsService(
			mockLibrariesService as any,
			mockStreamingCoreService as any,
			mockAudioCacheService as any,
		);
	});

	it("throws NotFoundException when library not found", async () => {
		mockLibrariesService.findLibrary.mockReturnValue(null);
		await expect(
			service.createSession("p1", "lib1", "t1"),
		).rejects.toThrow(NotFoundException);
	});

	it("throws ServiceUnavailableException when no producer", async () => {
		mockLibrariesService.findLibrary.mockReturnValue({
			handler: { id: "lib1" },
		});
		mockAudioCacheService.getAudioProducer.mockResolvedValue(null);

		await expect(
			service.createSession("p1", "lib1", "t1"),
		).rejects.toThrow(ServiceUnavailableException);
	});

	it("creates a stream instance", async () => {
		const instance = { id: "stream-1" };
		mockLibrariesService.findLibrary.mockReturnValue({
			handler: { id: "lib1" },
		});
		mockAudioCacheService.getAudioProducer.mockResolvedValue({
			type: "stream",
		});
		mockStreamingCoreService.createStreamInstance.mockReturnValue(instance);

		const result = await service.createSession("p1", "lib1", "t1");
		expect(result).toBe(instance);
		expect(mockStreamingCoreService.createStreamInstance).toHaveBeenCalledWith({
			type: "stream",
		});
	});
});
