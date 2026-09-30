import { ExternalUrlsService } from "./external-urls.service";
import { IconsService } from "src/icons/icons.service";

const makePlugin = (name: string) =>
	({
		package: { name },
		plugin: {},
		directoryPath: `/plugins/${name}`,
		updateStatus: "ok",
	}) as any;

const makeSource = (
	id: string,
	urls: { url: string; name: string; iconId: string }[] = [],
) =>
	({
		id,
		getArtistUrls: jest.fn().mockReturnValue(urls),
		getAlbumUrls: jest.fn().mockReturnValue(urls),
		getTrackUrls: jest.fn().mockReturnValue(urls),
	}) as any;

describe("ExternalUrlsService", () => {
	let service: ExternalUrlsService;
	let mockIconsService: { getIcon: jest.Mock };

	beforeEach(() => {
		mockIconsService = {
			getIcon: jest.fn().mockReturnValue({ id: "icon1" }),
		};
		service = new ExternalUrlsService(mockIconsService as any);
	});

	describe("registerSource", () => {
		it("stores source for new plugin", () => {
			service.registerSource(makeSource("s1"), makePlugin("plug-a"));
			const urls = service.getArtistUrls({} as any);
			expect(urls).toEqual([]);
		});

		it("allows multiple sources per plugin", () => {
			const urls1 = [{ url: "https://1.com", name: "1", iconId: "i" }];
			const urls2 = [{ url: "https://2.com", name: "2", iconId: "i" }];
			service.registerSource(makeSource("s1", urls1), makePlugin("plug-a"));
			service.registerSource(makeSource("s2", urls2), makePlugin("plug-a"));
			const result = service.getArtistUrls({} as any);
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.url).sort()).toEqual(["https://1.com", "https://2.com"]);
		});

		it("ignores duplicate source registration", () => {
			const urls = [{ url: "https://a.com", name: "A", iconId: "i" }];
			const source = makeSource("s1", urls);
			const plugin = makePlugin("plug-a");
			service.registerSource(source, plugin);
			service.registerSource(source, plugin);
			const result = service.getArtistUrls({} as any);
			expect(result).toHaveLength(1);
		});
	});

	describe("unregisterSource", () => {
		it("removes source", () => {
			const urls = [{ url: "https://a.com", name: "A", iconId: "i" }];
			const source = makeSource("s1", urls);
			const plugin = makePlugin("plug-a");
			service.registerSource(source, plugin);
			expect(service.getArtistUrls({} as any)).toHaveLength(1);
			service.unregisterSource(source, plugin);
			expect(service.getArtistUrls({} as any)).toHaveLength(0);
		});

		it("no-op for unknown plugin", () => {
			expect(() =>
				service.unregisterSource(makeSource("x"), makePlugin("unknown")),
			).not.toThrow();
		});
	});

	describe("getArtistUrls", () => {
		it("returns urls with icons", () => {
			const urls = [
				{ url: "https://a.com", name: "A", iconId: "icon1" },
			];
			service.registerSource(makeSource("s1", urls), makePlugin("plug-a"));

			const result = service.getArtistUrls({} as any);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe("https://a.com");
			expect(result[0].name).toBe("A");
			expect(result[0].iconUrl.url).toBe("/icons/plug-a/icon1");
		});

		it("skips urls with missing icons", () => {
			mockIconsService.getIcon.mockReturnValue(null);
			const urls = [
				{ url: "https://a.com", name: "A", iconId: "missing" },
			];
			service.registerSource(makeSource("s1", urls), makePlugin("plug-a"));

			const result = service.getArtistUrls({} as any);
			expect(result).toHaveLength(0);
		});

		it("continues when source throws", () => {
			const source = {
				id: "s1",
				getArtistUrls: jest.fn().mockImplementation(() => {
					throw new Error("boom");
				}),
				getAlbumUrls: jest.fn(),
				getTrackUrls: jest.fn(),
			};
			service.registerSource(source, makePlugin("plug-a"));

			expect(() => service.getArtistUrls({} as any)).not.toThrow();
		});

		it("returns empty when no sources registered", () => {
			expect(service.getArtistUrls({} as any)).toEqual([]);
		});
	});

	describe("getAlbumUrls", () => {
		it("delegates to source getAlbumUrls", () => {
			const urls = [
				{ url: "https://alb.com", name: "Album", iconId: "i" },
			];
			const source = makeSource("s1", urls);
			service.registerSource(source, makePlugin("plug-a"));

			const result = service.getAlbumUrls({} as any);
			expect(source.getAlbumUrls).toHaveBeenCalled();
			expect(result).toHaveLength(1);
		});
	});

	describe("getTrackUrls", () => {
		it("delegates to source getTrackUrls", () => {
			const urls = [
				{ url: "https://trk.com", name: "Track", iconId: "i" },
			];
			const source = makeSource("s1", urls);
			service.registerSource(source, makePlugin("plug-a"));

			const result = service.getTrackUrls({} as any);
			expect(source.getTrackUrls).toHaveBeenCalled();
			expect(result).toHaveLength(1);
		});
	});
});
