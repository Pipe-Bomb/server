import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In } from "typeorm";
import { SearchService } from "./search.service";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { SearchSourcesService } from "./search-sources.service";
import { AttributeType } from "src/attributes/enum/attribute-type.enum";

describe("SearchService", () => {
	let service: SearchService;
	let mockTrackManagerService: { find: jest.Mock };
	let artistsRepo: any;
	let mockAlbumManagerService: { findMany: jest.Mock };
	let mockSearchSourcesService: {
		hasSource: jest.Mock;
		search: jest.Mock;
	};

	beforeEach(async () => {
		mockTrackManagerService = { find: jest.fn() };
		artistsRepo = { find: jest.fn() };
		mockAlbumManagerService = { findMany: jest.fn() };
		mockSearchSourcesService = {
			hasSource: jest.fn().mockReturnValue(true),
			search: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SearchService,
				{
					provide: TrackManagerService,
					useValue: mockTrackManagerService,
				},
				{
					provide: getRepositoryToken(DBArtist),
					useValue: artistsRepo,
				},
				{
					provide: AlbumManagerService,
					useValue: mockAlbumManagerService,
				},
				{
					provide: SearchSourcesService,
					useValue: mockSearchSourcesService,
				},
			],
		}).compile();

		service = module.get(SearchService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("search", () => {
		it("returns empty when no search source", async () => {
			mockSearchSourcesService.hasSource.mockReturnValue(false);
			const result = await service.search({
				query: "test",
				trackAmount: 10,
				artistAmount: 5,
				albumAmount: 5,
				attributes: [],
			});
			expect(result).toEqual({ tracks: [], artists: [], albums: [] });
		});

		it("returns ordered results", async () => {
			mockSearchSourcesService.search.mockResolvedValue({
				tracks: ["t1", "t2"],
				artists: ["a1"],
				albums: ["al1"],
			});
			mockTrackManagerService.find.mockResolvedValue([
				{ uuid: "t1", toResponse: () => ({}) },
				{ uuid: "t2", toResponse: () => ({}) },
			]);
			artistsRepo.find.mockResolvedValue([
				{ uuid: "a1", toResponse: () => ({}) },
			]);
			mockAlbumManagerService.findMany.mockResolvedValue([
				{ uuid: "al1", toResponse: () => ({}) },
			]);

			const result = await service.search({
				query: "rock",
				trackAmount: 10,
				artistAmount: 5,
				albumAmount: 5,
				attributes: [],
			});

			expect(result.tracks).toHaveLength(2);
			expect(result.artists).toHaveLength(1);
			expect(result.albums).toHaveLength(1);
			expect(mockSearchSourcesService.search).toHaveBeenCalledWith(
				expect.objectContaining({
					query: "rock",
					entities: expect.objectContaining({
						tracks: { limit: 10 },
						artists: { limit: 5 },
						albums: { limit: 5 },
					}),
				}),
			);
		});

		it("passes attributes as filters", async () => {
			mockSearchSourcesService.search.mockResolvedValue({
				tracks: [],
				artists: [],
				albums: [],
			});

			await service.search({
				query: "test",
				trackAmount: 10,
				artistAmount: 0,
				albumAmount: 0,
				attributes: [
					{
						entityType: "track",
						key: "genre",
						type: AttributeType.STRING,
						query: "rock",
						partial: false,
					} as any,
				],
			});

			const call = mockSearchSourcesService.search.mock.calls[0][0];
			expect(call.filters).toHaveLength(1);
			expect(call.filters[0]).toEqual(
				expect.objectContaining({
					entityType: "track",
					attributeKey: "genre",
					attributeType: "string",
					value: "rock",
				}),
			);
		});
	});
});
