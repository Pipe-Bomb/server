import { StreamingCoreService } from "./streaming-core.service";
import { StreamStreamInstance } from "./stream-instance/stream.stream-instance";
import { HLSStreamInstance } from "./stream-instance/hls.stream-instance";

describe("StreamingCoreService", () => {
	let service: StreamingCoreService;

	beforeEach(() => {
		service = new StreamingCoreService();
	});

	describe("createStreamInstance", () => {
		it("creates a StreamStreamInstance for stream type", () => {
			const producer = {
				type: "stream" as const,
				cacheable: false,
				getStream: jest.fn(),
				getMetadata: jest.fn(),
				getPart: jest.fn(),
			};
			const instance = service.createStreamInstance(producer);
			expect(instance).toBeInstanceOf(StreamStreamInstance);
		});

		it("creates an HLSStreamInstance for hls type", () => {
			const producer = {
				type: "hls" as const,
				cacheable: false,
				getPlaylist: jest.fn(),
			};
			const instance = service.createStreamInstance(producer);
			expect(instance).toBeInstanceOf(HLSStreamInstance);
		});
	});

	describe("getInstance", () => {
		it("returns the instance by id", () => {
			const producer = {
				type: "stream" as const,
				cacheable: false,
				getStream: jest.fn(),
				getMetadata: jest.fn(),
				getPart: jest.fn(),
			};
			const instance = service.createStreamInstance(producer);
			expect(service.getInstance(instance.id)).toBe(instance);
		});

		it("returns null for unknown id", () => {
			expect(service.getInstance("nonexistent")).toBeNull();
		});
	});
});
