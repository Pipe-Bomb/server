import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PlaybackHistoryService } from "./playback-history.service";
import { DBPlaybackHistoryEntry } from "./entity/playback-history-entry.entity";

const createMockRepo = () => ({
	findAndCount: jest.fn(),
	createQueryBuilder: jest.fn(),
});

describe("PlaybackHistoryService", () => {
	let service: PlaybackHistoryService;
	let repo: ReturnType<typeof createMockRepo>;

	beforeEach(async () => {
		repo = createMockRepo();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PlaybackHistoryService,
				{
					provide: getRepositoryToken(DBPlaybackHistoryEntry),
					useValue: repo,
				},
			],
		}).compile();

		service = module.get(PlaybackHistoryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("addHistoryEntry", () => {
		it("inserts via query builder with orIgnore", async () => {
			const qb = {
				insert: jest.fn().mockReturnThis(),
				into: jest.fn().mockReturnThis(),
				values: jest.fn().mockReturnThis(),
				orIgnore: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			repo.createQueryBuilder.mockReturnValue(qb);

			const date = new Date("2025-01-01");
			await service.addHistoryEntry(
				"track1",
				"user1",
				"plugin1",
				"client",
				date,
			);

			expect(qb.values).toHaveBeenCalledWith(
				expect.objectContaining({
					trackUuid: "track1",
					userUuid: "user1",
					pluginId: "plugin1",
					clientName: "client",
					datePlayed: date.getTime(),
				}),
			);
			expect(qb.orIgnore).toHaveBeenCalled();
			expect(qb.execute).toHaveBeenCalled();
		});
	});

	describe("getUserHistory", () => {
		it("returns entries and total", async () => {
			const entries = [{ trackUuid: "t1", userUuid: "u1" }];
			repo.findAndCount.mockResolvedValue([entries, 1]);

			const result = await service.getUserHistory("u1", {
				amount: 10,
				offset: 0,
			});

			expect(result).toEqual({ entries, total: 1 });
			expect(repo.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userUuid: "u1" },
					take: 10,
					skip: 0,
					order: { datePlayed: "desc" },
				}),
			);
		});

		it("filters by null pluginId", async () => {
			repo.findAndCount.mockResolvedValue([[], 0]);
			await service.getUserHistory("u1", {
				amount: 10,
				offset: 0,
				pluginId: null,
			});

			const call = repo.findAndCount.mock.calls[0][0];
			expect(call.where.pluginId).toBeDefined();
			expect(call.where.pluginId._type).toBe("isNull");
		});

		it("filters by clientName", async () => {
			repo.findAndCount.mockResolvedValue([[], 0]);
			await service.getUserHistory("u1", {
				amount: 10,
				offset: 0,
				clientName: "myclient",
			});

			const call = repo.findAndCount.mock.calls[0][0];
			expect(call.where.clientName).toBe("myclient");
		});
	});

	describe("createClient", () => {
		it("returns a PlaybackHistoryClient bound to the plugin", async () => {
			const plugin = { package: { name: "plug" } };
			const client = service.createClient(plugin as any);

			expect(client).toHaveProperty("addHistoryEntry");
			expect(client).toHaveProperty("getUserHistory");

			const qb = {
				insert: jest.fn().mockReturnThis(),
				into: jest.fn().mockReturnThis(),
				values: jest.fn().mockReturnThis(),
				orIgnore: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			};
			repo.createQueryBuilder.mockReturnValue(qb);

			const date = new Date("2025-01-01");
			await client.addHistoryEntry("t1", "u1", "client", date);

			expect(qb.values).toHaveBeenCalledWith(
				expect.objectContaining({
					trackUuid: "t1",
					userUuid: "u1",
					pluginId: "plug",
					clientName: "client",
				}),
			);
		});
	});
});
