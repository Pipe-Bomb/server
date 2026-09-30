import {
	BadRequestException,
	ConflictException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DBMarketplace } from "./entity/marketplace.entity";
import { MarketplacesService } from "./marketplaces.service";
import { PluginsService } from "src/plugins/plugins.service";

jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

const mockRepo = {
	find: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	save: jest.fn(),
	update: jest.fn(),
	remove: jest.fn(),
};
const mockPluginsService = {
	all: jest.fn(),
};

const MANIFEST_TTL_MS = 5 * 60 * 1000;

function validManifest(overrides: Record<string, unknown> = {}) {
	return {
		name: "Test Marketplace",
		plugins: [
			{
				id: "plugin-a",
				name: "Plugin A",
				authorName: "Author",
				repository: "https://git.example.com/plugin-a.git",
			},
		],
		...overrides,
	};
}

function row(overrides: Partial<DBMarketplace> = {}): DBMarketplace {
	return {
		uuid: "mp-uuid",
		url: "https://marketplace.example.com/manifest.json",
		name: "Stored Name",
		addedAt: 12345,
		...overrides,
	} as DBMarketplace;
}

describe("MarketplacesService", () => {
	let service: MarketplacesService;
	let fetchSpy: jest.SpyInstance;
	let dateSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MarketplacesService,
				{ provide: getRepositoryToken(DBMarketplace), useValue: mockRepo },
				{ provide: PluginsService, useValue: mockPluginsService },
			],
		}).compile();
		service = module.get(MarketplacesService);
		fetchSpy = jest.spyOn(globalThis, "fetch");
		dateSpy = jest.spyOn(Date, "now");
		warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		dateSpy.mockRestore();
		warnSpy.mockRestore();
	});

	function mockFetchOk(data: unknown) {
		fetchSpy.mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(data),
		});
	}

	describe("addMarketplace()", () => {
		it("throws ConflictException when the url is already added", async () => {
			mockRepo.findOne.mockResolvedValue(row());

			await expect(service.addMarketplace(row().url)).rejects.toThrow(
				new ConflictException(`Marketplace "${row().url}" is already added`),
			);
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(mockRepo.save).not.toHaveBeenCalled();
		});

		it("throws BadRequestException when the manifest is unreachable", async () => {
			mockRepo.findOne.mockResolvedValue(null);
			fetchSpy.mockResolvedValue({ ok: false, status: 500 });

			await expect(service.addMarketplace(row().url)).rejects.toThrow(
				new BadRequestException(
					`Could not fetch a valid manifest from "${row().url}"`,
				),
			);
			expect(mockRepo.save).not.toHaveBeenCalled();
		});

		it("throws BadRequestException when the manifest fails validation", async () => {
			mockRepo.findOne.mockResolvedValue(null);
			mockFetchOk({ plugins: [] });

			await expect(service.addMarketplace(row().url)).rejects.toThrow(
				BadRequestException,
			);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("failed validation"),
				expect.anything(),
			);
			expect(mockRepo.save).not.toHaveBeenCalled();
		});

		it("fetches, persists and returns the new marketplace", async () => {
			const url = row().url;
			mockRepo.findOne.mockResolvedValue(null);
			mockFetchOk(validManifest());
			mockRepo.create.mockImplementation((data: object) => data);
			mockRepo.save.mockImplementation((entity: DBMarketplace) =>
				Promise.resolve({
					uuid: "mp-uuid",
					addedAt: 12345,
					...entity,
				}),
			);

			const result = await service.addMarketplace(url);

			expect(fetchSpy).toHaveBeenCalledWith(url);
			expect(mockRepo.update).toHaveBeenCalledWith(
				{ url },
				{ name: "Test Marketplace" },
			);
			expect(mockRepo.create).toHaveBeenCalledWith({
				url,
				name: "Test Marketplace",
			});
			expect(result).toEqual({
				uuid: "mp-uuid",
				url,
				name: "Test Marketplace",
				pluginCount: 1,
				reachable: true,
				addedAt: 12345,
			});
		});
	});

	describe("removeMarketplace()", () => {
		it("throws NotFoundException when no marketplace has the uuid", async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.removeMarketplace("nope")).rejects.toThrow(
				new NotFoundException(`Marketplace "nope" not found`),
			);
			expect(mockRepo.remove).not.toHaveBeenCalled();
		});

		it("removes the row and clears the cached manifest", async () => {
			const entity = row();
			mockRepo.find.mockResolvedValue([entity]);
			mockRepo.findOne.mockResolvedValue(entity);
			mockFetchOk(validManifest());
			dateSpy.mockReturnValue(1_000_000);

			await service.listMarketplaces();
			expect(fetchSpy).toHaveBeenCalledTimes(1);

			await service.removeMarketplace(entity.uuid);

			expect(mockRepo.remove).toHaveBeenCalledWith(entity);

			await service.listMarketplaces();
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("listMarketplaces()", () => {
		it("reports an unreachable marketplace using the stored name", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			fetchSpy.mockRejectedValue(new Error("network down"));

			const result = await service.listMarketplaces();

			expect(result).toEqual([
				{
					uuid: "mp-uuid",
					url: row().url,
					name: "Stored Name",
					pluginCount: null,
					reachable: false,
					addedAt: 12345,
				},
			]);
		});

		it("reports a null name as null when unreachable", async () => {
			mockRepo.find.mockResolvedValue([row({ name: null })]);
			fetchSpy.mockRejectedValue(new Error("network down"));

			const result = await service.listMarketplaces();

			expect(result[0].name).toBeNull();
			expect(result[0].reachable).toBe(false);
			expect(result[0].pluginCount).toBeNull();
		});

		it("reports reachable marketplaces with the manifest name and plugin count", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			mockFetchOk(validManifest());

			const result = await service.listMarketplaces();

			expect(result).toEqual([
				{
					uuid: "mp-uuid",
					url: row().url,
					name: "Test Marketplace",
					pluginCount: 1,
					reachable: true,
					addedAt: 12345,
				},
			]);
		});
	});

	describe("manifest caching", () => {
		it("serves the cached manifest within the 5 minute TTL", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			mockFetchOk(validManifest());
			dateSpy.mockReturnValue(1_000_000);
			await service.listMarketplaces();

			dateSpy.mockReturnValue(1_000_000 + MANIFEST_TTL_MS - 60_000);
			await service.listMarketplaces();

			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it("re-fetches once the TTL has expired", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			mockFetchOk(validManifest());
			dateSpy.mockReturnValue(1_000_000);
			await service.listMarketplaces();

			dateSpy.mockReturnValue(1_000_000 + MANIFEST_TTL_MS + 1);
			await service.listMarketplaces();

			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});

		it("does not cache manifests that fail validation", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			mockFetchOk({ plugins: [] });
			dateSpy.mockReturnValue(1_000_000);

			await service.listMarketplaces();
			await service.listMarketplaces();

			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("listPlugins()", () => {
		it("skips marketplaces whose manifest is null", async () => {
			const reachable = row({
				uuid: "mp-1",
				url: "https://reachable.example.com/manifest.json",
			});
			const unreachable = row({
				uuid: "mp-2",
				url: "https://unreachable.example.com/manifest.json",
				name: null,
			});
			mockPluginsService.all.mockReturnValue([]);
			mockRepo.find.mockResolvedValue([reachable, unreachable]);
			fetchSpy.mockImplementation((url: string) => {
				if (url === unreachable.url) {
					return Promise.reject(new Error("down"));
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(validManifest()),
				});
			});

			const result = await service.listPlugins();

			expect(fetchSpy).toHaveBeenCalledTimes(2);
			expect(result).toHaveLength(1);
			expect(result[0].marketplaceUuid).toBe("mp-1");
		});

		it("maps plugins, nulling optional fields and flagging installed ones", async () => {
			mockRepo.find.mockResolvedValue([row()]);
			mockPluginsService.all.mockReturnValue([
				{ package: { name: "plugin-a" } },
			]);
			mockFetchOk({
				name: "Test Marketplace",
				plugins: [
					{
						id: "plugin-a",
						name: "Plugin A",
						authorName: "Author",
						repository: "https://git.example.com/plugin-a.git",
					},
					{
						id: "plugin-b",
						name: "Plugin B",
						description: "B",
						authorName: "Author",
						authorUrl: "https://author.example.com",
						url: "https://plugin-b.example.com",
						repository: "https://git.example.com/plugin-b.git",
					},
				],
			});

			const result = await service.listPlugins();

			expect(result).toEqual([
				{
					id: "plugin-a",
					name: "Plugin A",
					description: null,
					authorName: "Author",
					authorUrl: null,
					url: null,
					repository: "https://git.example.com/plugin-a.git",
					marketplaceUuid: "mp-uuid",
					marketplaceName: "Test Marketplace",
					installed: true,
				},
				{
					id: "plugin-b",
					name: "Plugin B",
					description: "B",
					authorName: "Author",
					authorUrl: "https://author.example.com",
					url: "https://plugin-b.example.com",
					repository: "https://git.example.com/plugin-b.git",
					marketplaceUuid: "mp-uuid",
					marketplaceName: "Test Marketplace",
					installed: false,
				},
			]);
		});
	});
});
