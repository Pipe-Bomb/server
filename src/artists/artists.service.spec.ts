import { ArtistsService } from "./artists.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { DisabledIdentifiersService } from "src/identifiers/disabled-identifiers.service";
import { TasksService } from "src/tasks/tasks.service";


describe("ArtistsService", () => {
	let service: ArtistsService;
	let mockArtistManagerService: any;
	let mockDisabledIdentifiersService: any;
	let mockTasksService: any;
	let mockRepository: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockArtistManagerService = {
			count: jest.fn(),
			identifyArtist: jest.fn(),
		};
		mockDisabledIdentifiersService = {
			getDisabledSet: jest.fn(),
		};
		mockTasksService = {
			registerSystemTask: jest.fn(),
		};
		mockRepository = {
			find: jest.fn(),
		};

		service = new ArtistsService(
			mockArtistManagerService as any,
			mockDisabledIdentifiersService as any,
			mockTasksService as any,
			mockRepository as any,
		);
	});

	describe("constructor", () => {
		it("registers the identify-artists system task", () => {
			expect(mockTasksService.registerSystemTask).toHaveBeenCalledWith(
				expect.objectContaining({ id: "identify-artists" }),
			);
		});
	});

	describe("identifyAllArtists", () => {
		it("returns immediately when no artists to identify", async () => {
			mockArtistManagerService.count.mockResolvedValue(0);

			await service.identifyAllArtists("runId", true);

			expect(mockArtistManagerService.count).toHaveBeenCalledTimes(1);
			expect(mockDisabledIdentifiersService.getDisabledSet).not.toHaveBeenCalled();
		});

		it("identifies each artist from the pool and reports progress", async () => {
			const artists = [{ uuid: "a1" }, { uuid: "a2" }];
			mockArtistManagerService.count.mockResolvedValue(2);
			mockDisabledIdentifiersService.getDisabledSet.mockResolvedValue(new Set());
			mockRepository.find.mockResolvedValueOnce(artists).mockResolvedValue([]);
			mockArtistManagerService.identifyArtist
				.mockResolvedValueOnce({
					mergedArtists: ["a1"],
					identities: [],
					splitCount: 0,
				})
				.mockResolvedValueOnce({
					mergedArtists: ["a2"],
					identities: [],
					splitCount: 0,
				});
			const progress: [number, number][] = [];

			await service.identifyAllArtists(
				"run-1",
				false,
				(completed, total) => progress.push([completed, total]),
			);

			expect(mockArtistManagerService.identifyArtist).toHaveBeenCalledTimes(2);
			expect(progress.at(-1)).toEqual([2, 2]);
		});
	});
});