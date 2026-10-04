import { BookmarksService } from "./bookmarks.service";

describe("BookmarksService", () => {
	let service: BookmarksService;
	let savedAlbumsRepository: any;
	let savedArtistsRepository: any;
	let savedTracksRepository: any;

	beforeEach(() => {
		savedAlbumsRepository = { find: jest.fn(async () => []) };
		savedArtistsRepository = { find: jest.fn(async () => []) };
		savedTracksRepository = { find: jest.fn(async () => []) };

		service = new BookmarksService(
			savedAlbumsRepository,
			savedArtistsRepository,
			savedTracksRepository,
		);
	});

	describe("getBookmarkedAlbumUuids", () => {
		it("returns empty set without querying when user is null", async () => {
			const result = await service.getBookmarkedAlbumUuids(null, ["a"]);
			expect(result.size).toBe(0);
			expect(savedAlbumsRepository.find).not.toHaveBeenCalled();
		});

		it("returns empty set without querying when no uuids", async () => {
			const result = await service.getBookmarkedAlbumUuids("user-1", []);
			expect(result.size).toBe(0);
			expect(savedAlbumsRepository.find).not.toHaveBeenCalled();
		});

		it("runs a single batched query and returns bookmarked uuids", async () => {
			savedAlbumsRepository.find.mockResolvedValue([{ albumUuid: "a" }]);

			const result = await service.getBookmarkedAlbumUuids("user-1", [
				"a",
				"b",
			]);

			expect(savedAlbumsRepository.find).toHaveBeenCalledTimes(1);
			const arg = savedAlbumsRepository.find.mock.calls[0][0];
			expect(arg.where.userUuid).toBe("user-1");
			expect(arg.select).toEqual(["albumUuid"]);
			expect([...result]).toEqual(["a"]);
		});
	});

	describe("getBookmarkedArtistUuids", () => {
		it("returns empty set without querying when user is null", async () => {
			const result = await service.getBookmarkedArtistUuids(null, ["a"]);
			expect(result.size).toBe(0);
			expect(savedArtistsRepository.find).not.toHaveBeenCalled();
		});

		it("runs a single batched query and returns bookmarked uuids", async () => {
			savedArtistsRepository.find.mockResolvedValue([
				{ artistUuid: "a" },
				{ artistUuid: "c" },
			]);

			const result = await service.getBookmarkedArtistUuids("user-1", [
				"a",
				"b",
				"c",
			]);

			expect(savedArtistsRepository.find).toHaveBeenCalledTimes(1);
			const arg = savedArtistsRepository.find.mock.calls[0][0];
			expect(arg.where.userUuid).toBe("user-1");
			expect(arg.select).toEqual(["artistUuid"]);
			expect([...result]).toEqual(["a", "c"]);
		});
	});

	describe("getBookmarkedTrackUuids", () => {
		it("returns empty set without querying when no uuids", async () => {
			const result = await service.getBookmarkedTrackUuids("user-1", []);
			expect(result.size).toBe(0);
			expect(savedTracksRepository.find).not.toHaveBeenCalled();
		});

		it("runs a single batched query and returns bookmarked uuids", async () => {
			savedTracksRepository.find.mockResolvedValue([{ trackUuid: "b" }]);

			const result = await service.getBookmarkedTrackUuids("user-1", [
				"a",
				"b",
			]);

			expect(savedTracksRepository.find).toHaveBeenCalledTimes(1);
			const arg = savedTracksRepository.find.mock.calls[0][0];
			expect(arg.where.userUuid).toBe("user-1");
			expect(arg.select).toEqual(["trackUuid"]);
			expect([...result]).toEqual(["b"]);
		});
	});

	describe("annotate", () => {
		const album = (uuid: string | null, extra: any = {}) => ({
			uuid,
			bookmarked: null,
			artists: [],
			tracks: [],
			...extra,
		});
		const artist = (uuid: string | null, extra: any = {}) => ({
			uuid,
			bookmarked: null,
			tracks: [],
			albums: [],
			...extra,
		});
		const track = (uuid: string | null, extra: any = {}) => ({
			uuid,
			trackId: "t",
			bookmarked: null,
			artists: [],
			albums: [],
			...extra,
		});

		it("does nothing when there is no user", async () => {
			const data = album("album-1");

			const result = await service.annotate(null, data);

			expect(result).toBe(data);
			expect(data.bookmarked).toBeNull();
			expect(savedAlbumsRepository.find).not.toHaveBeenCalled();
		});

		it("annotates top-level album, artist and track", async () => {
			savedAlbumsRepository.find.mockResolvedValue([{ albumUuid: "album-1" }]);
			savedArtistsRepository.find.mockResolvedValue([{ artistUuid: "artist-2" }]);
			savedTracksRepository.find.mockResolvedValue([{ trackUuid: "track-1" }]);

			const a = album("album-1");
			const ar = artist("artist-1");
			const t = track("track-1");

			await service.annotate("user-1", [a, ar, t]);

			expect(a.bookmarked).toBe(true);
			expect(ar.bookmarked).toBe(false);
			expect(t.bookmarked).toBe(true);
		});

		it("annotates nested entities", async () => {
			savedTracksRepository.find.mockResolvedValue([{ trackUuid: "track-1" }]);

			const t = track("track-1");
			const a = album("album-1", { tracks: [t] });

			await service.annotate("user-1", a);

			expect(a.bookmarked).toBe(false);
			expect(t.bookmarked).toBe(true);
		});

		it("is cycle safe", async () => {
			const a = album("album-1");
			const t = track("track-1");
			(a as any).tracks.push(t);
			(t as any).albums.push(a);

			await service.annotate("user-1", a);

			expect(a.bookmarked).toBe(false);
			expect(t.bookmarked).toBe(false);
		});

		it("queries only the entity types present", async () => {
			savedAlbumsRepository.find.mockResolvedValue([{ albumUuid: "album-1" }]);

			await service.annotate("user-1", album("album-1"));

			expect(savedAlbumsRepository.find).toHaveBeenCalledTimes(1);
			expect(savedArtistsRepository.find).not.toHaveBeenCalled();
			expect(savedTracksRepository.find).not.toHaveBeenCalled();
		});

		it("skips entities without a uuid (ephemeral)", async () => {
			const a = album(null);

			await service.annotate("user-1", a);

			expect(a.bookmarked).toBeNull();
			expect(savedAlbumsRepository.find).not.toHaveBeenCalled();
		});

		it("skips non-plain objects", async () => {
			await service.annotate("user-1", {
				date: new Date(),
				buffer: Buffer.from("x"),
			});

			expect(savedAlbumsRepository.find).not.toHaveBeenCalled();
			expect(savedArtistsRepository.find).not.toHaveBeenCalled();
			expect(savedTracksRepository.find).not.toHaveBeenCalled();
		});
	});
});
