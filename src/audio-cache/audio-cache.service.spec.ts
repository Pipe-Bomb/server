/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { AudioCacheService } from "./audio-cache.service";
import { existsSync } from "fs";
import * as fsPromises from "fs/promises";

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
		getExtension: jest.fn(),
	},
}));

jest.mock("music-metadata");

jest.mock("fs", () => ({
	...jest.requireActual("fs"),
	existsSync: jest.fn(),
	createReadStream: jest.fn(),
	createWriteStream: jest.fn(),
}));

jest.mock("fs/promises", () => ({
	...jest.requireActual("fs/promises"),
	mkdir: jest.fn(),
	rm: jest.fn(),
	stat: jest.fn(),
	rename: jest.fn(),
	copyFile: jest.fn(),
	unlink: jest.fn(),
	lstat: jest.fn(),
	writeFile: jest.fn(),
	readFile: jest.fn(),
}));

jest.mock("stream/promises", () => ({
	...jest.requireActual("stream/promises"),
	finished: jest.fn(),
}));

const makeHandler = (id = "lib-1") => ({
	id,
	getAudioProducer: jest.fn(),
});

const makeLibrary = (handler = makeHandler()) =>
	({ handler, plugin: {} }) as any;

const makeTrack = () =>
	({ pluginId: "plug-a", libraryId: "lib-1", trackId: "track-1" }) as any;

describe("AudioCacheService", () => {
	let service: AudioCacheService;
	let streamingCoreService: { createStreamInstance: jest.Mock };

	beforeEach(() => {
		jest.resetAllMocks();
		streamingCoreService = { createStreamInstance: jest.fn() };
		service = new AudioCacheService(streamingCoreService);
	});

	describe("getAudioProducer", () => {
		it("returns a stream producer backed by the cached file when the cache exists", async () => {
			jest.mocked(existsSync).mockReturnValue(true);
			jest
				.mocked(fsPromises.readFile)
				.mockResolvedValue(
					JSON.stringify({ size: 2048, mimeType: "audio/mpeg" }),
				);
			const handler = makeHandler();

			const producer = await service.getAudioProducer(
				handler as any,
				"plug-a",
				"track-1",
				null,
			);

			expect(handler.getAudioProducer).not.toHaveBeenCalled();
			expect(producer).not.toBeNull();
			expect(producer!.type).toBe("stream");
			expect(producer!.cacheable).toBe(false);
			await expect(producer!.getMetadata()).resolves.toEqual({
				size: 2048,
				mimeType: "audio/mpeg",
			});
		});

		it("falls back to the handler when the cache does not exist", async () => {
			jest.mocked(existsSync).mockReturnValue(false);
			const handler = makeHandler();
			const expected = { type: "stream" as const, cacheable: true };
			handler.getAudioProducer.mockResolvedValue(expected);

			const producer = await service.getAudioProducer(
				handler as any,
				"plug-a",
				"track-1",
				null,
			);

			expect(handler.getAudioProducer).toHaveBeenCalledWith("track-1", null);
			expect(producer).toBe(expected);
		});

		it("always uses the handler when a non-stream type is requested", async () => {
			jest.mocked(existsSync).mockReturnValue(true);
			const handler = makeHandler();
			const expected = { type: "hls" as const, cacheable: false };
			handler.getAudioProducer.mockResolvedValue(expected);

			const producer = await service.getAudioProducer(
				handler as any,
				"plug-a",
				"track-1",
				"hls",
			);

			expect(handler.getAudioProducer).toHaveBeenCalledWith("track-1", "hls");
			expect(fsPromises.readFile).not.toHaveBeenCalled();
			expect(producer).toBe(expected);
		});

		it("uses the handler when the cached sidecar cannot be read", async () => {
			jest.mocked(existsSync).mockReturnValue(true);
			jest.mocked(fsPromises.readFile).mockRejectedValue(new Error("io"));
			const handler = makeHandler();
			const expected = { type: "stream" as const, cacheable: true };
			handler.getAudioProducer.mockResolvedValue(expected);

			const producer = await service.getAudioProducer(
				handler as any,
				"plug-a",
				"track-1",
				null,
			);

			expect(producer).toBe(expected);
		});
	});

	describe("cacheTrack", () => {
		it("returns false when the file and sidecar already exist", async () => {
			jest.mocked(existsSync).mockReturnValue(true);
			const library = makeLibrary();

			await expect(service.cacheTrack(library, makeTrack())).resolves.toBe(
				false,
			);
			expect(library.handler.getAudioProducer).not.toHaveBeenCalled();
			expect(fsPromises.stat).not.toHaveBeenCalled();
		});

		it("throws when the handler returns no producer", async () => {
			jest.mocked(existsSync).mockReturnValue(false);
			const library = makeLibrary();
			library.handler.getAudioProducer.mockResolvedValue(null);

			await expect(service.cacheTrack(library, makeTrack())).rejects.toThrow(
				"Unable to create Audio Producer",
			);
		});

		it("returns false for a non-cacheable producer", async () => {
			jest.mocked(existsSync).mockReturnValue(false);
			const library = makeLibrary();
			library.handler.getAudioProducer.mockResolvedValue({
				type: "stream",
				cacheable: false,
			});

			await expect(service.cacheTrack(library, makeTrack())).resolves.toBe(
				false,
			);
			expect(streamingCoreService.createStreamInstance).not.toHaveBeenCalled();
		});

		it("passes the track id to the handler when requesting a producer", async () => {
			jest.mocked(existsSync).mockReturnValue(false);
			const library = makeLibrary();
			library.handler.getAudioProducer.mockResolvedValue(null);

			await service.cacheTrack(library, makeTrack()).catch(() => {});
			expect(library.handler.getAudioProducer).toHaveBeenCalledWith(
				"track-1",
				null,
			);
		});
	});
});
