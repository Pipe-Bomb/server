/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FindOperator } from "typeorm";
import { SmartPlaylistsService } from "./smart-playlists.service";

describe("SmartPlaylistsService", () => {
	let service: SmartPlaylistsService;
	let playlistsRepository: any;
	let filterGroupsRepository: any;
	let filtersRepository: any;
	let playlistTracksRepository: any;
	let playlistsService: any;
	let trackManagerService: any;
	let tasksService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		playlistsRepository = { count: jest.fn(), find: jest.fn(), update: jest.fn() };
		filterGroupsRepository = { create: jest.fn((o) => o), save: jest.fn(), findOneBy: jest.fn(), delete: jest.fn(), find: jest.fn() };
		filtersRepository = { create: jest.fn((o) => ({ ...o })), insert: jest.fn(), delete: jest.fn() };
		playlistTracksRepository = { find: jest.fn(), delete: jest.fn() };
		playlistsService = { addTracks: jest.fn() };
		trackManagerService = { findTracksBySmartFilters: jest.fn() };
		tasksService = { registerSystemTask: jest.fn() };

		service = new SmartPlaylistsService(
			playlistsRepository,
			filterGroupsRepository,
			filtersRepository,
			playlistTracksRepository,
			playlistsService,
			trackManagerService,
			tasksService,
		);
	});

	describe("constructor", () => {
		it("registers the scan-smart-filters system task", () => {
			expect(tasksService.registerSystemTask).toHaveBeenCalledTimes(1);
			const task = tasksService.registerSystemTask.mock.calls[0][0];
			expect(task.id).toBe("scan-smart-filters");
			expect(task.resumable).toBe(true);
			expect(typeof task.run).toBe("function");
		});
	});

	describe("addFilterGroup", () => {
		it("creates and saves a filter group, then inserts the mapped filters with the group uuid", async () => {
			filterGroupsRepository.create.mockReturnValue({
				uuid: "group-1",
				playlistUuid: "playlist-1",
			});
			const playlist = { uuid: "playlist-1" } as any;

			await service.addFilterGroup(playlist, [
				{
					entityType: "Track",
					attributeType: "string",
					attributeKey: "title",
					value: "foo",
				},
			]);

			expect(filterGroupsRepository.create).toHaveBeenCalledWith({
				playlistUuid: "playlist-1",
			});
			expect(filterGroupsRepository.save).toHaveBeenCalledTimes(1);
			expect(filtersRepository.insert).toHaveBeenCalledTimes(1);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities).toHaveLength(1);
			expect(entities[0].groupUuid).toBe("group-1");
			expect(entities[0].entityType).toBe("Track");
			expect(entities[0].attributeKey).toBe("title");
			expect(entities[0].attributeType).toBe("string");
			expect(entities[0].inverse).toBe(false);
		});

		it("maps a BOOLEAN filter with a value", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "boolean",
					attributeKey: "explicit",
					value: true,
					inverse: true,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_boolean).toBe(true);
			expect(entities[0].inverse).toBe(true);
		});

		it("maps a BOOLEAN filter without a value", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "boolean",
					attributeKey: "explicit",
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_boolean).toBeUndefined();
		});

		it("maps a STRING filter with value and partial flag", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "string",
					attributeKey: "title",
					value: "foo",
					partial: true,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_string).toBe("foo");
			expect(entities[0].partial).toBe(true);
		});

		it("maps a STRING filter without value or partial", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "string",
					attributeKey: "title",
					inverse: true,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_string).toBeUndefined();
			expect(entities[0].partial).toBeUndefined();
			expect(entities[0].inverse).toBe(true);
		});

		it("maps an INTEGER filter with value, min and max", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "integer",
					attributeKey: "year",
					value: 2024,
					min: 1990,
					max: 2025,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_int).toBe(2024);
			expect(entities[0].min).toBe(1990);
			expect(entities[0].max).toBe(2025);
		});

		it("maps an INTEGER filter with only min and max", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "integer",
					attributeKey: "year",
					min: 1990,
					max: 2025,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_int).toBeUndefined();
			expect(entities[0].min).toBe(1990);
			expect(entities[0].max).toBe(2025);
		});

		it("maps a DECIMAL filter with value, min and max", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "decimal",
					attributeKey: "bpm",
					value: 128.5,
					min: 100.1,
					max: 150.9,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_decimal).toBe(128.5);
			expect(entities[0].min).toBe(100.1);
			expect(entities[0].max).toBe(150.9);
		});

		it("maps a BUFFER filter without value fields", async () => {
			filterGroupsRepository.create.mockReturnValue({ uuid: "group-1" });

			await service.addFilterGroup({ uuid: "playlist-1" } as any, [
				{
					entityType: "Track",
					attributeType: "buffer",
					attributeKey: "thumb",
					inverse: true,
				},
			]);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities[0].value_boolean).toBeUndefined();
			expect(entities[0].value_string).toBeUndefined();
			expect(entities[0].value_int).toBeUndefined();
			expect(entities[0].value_decimal).toBeUndefined();
			expect(entities[0].inverse).toBe(true);
		});
	});

	describe("updateFilterGroup", () => {
		it("deletes the old filters and inserts the new ones for the group", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue({
				uuid: "group-1",
				playlistUuid: "playlist-1",
			});

			await service.updateFilterGroup("group-1", "playlist-1", [
				{
					entityType: "Track",
					attributeType: "string",
					attributeKey: "title",
					value: "bar",
				},
			]);

			expect(filterGroupsRepository.findOneBy).toHaveBeenCalledWith({
				uuid: "group-1",
			});
			expect(filtersRepository.delete).toHaveBeenCalledWith({
				groupUuid: "group-1",
			});
			expect(filtersRepository.insert).toHaveBeenCalledTimes(1);

			const [entities] = filtersRepository.insert.mock.calls[0];
			expect(entities).toHaveLength(1);
			expect(entities[0].groupUuid).toBe("group-1");
			expect(entities[0].value_string).toBe("bar");
		});

		it("throws NotFoundException when the filter group does not exist", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue(null);

			await expect(
				service.updateFilterGroup("missing", "playlist-1", []),
			).rejects.toThrow(NotFoundException);
			expect(filtersRepository.delete).not.toHaveBeenCalled();
			expect(filtersRepository.insert).not.toHaveBeenCalled();
		});

		it("throws BadRequestException when the group belongs to another playlist", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue({
				uuid: "group-1",
				playlistUuid: "other-playlist",
			});

			await expect(
				service.updateFilterGroup("group-1", "playlist-1", []),
			).rejects.toThrow(BadRequestException);
			expect(filtersRepository.delete).not.toHaveBeenCalled();
			expect(filtersRepository.insert).not.toHaveBeenCalled();
		});
	});

	describe("deleteFilterGroup", () => {
		it("deletes the filter group", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue({
				uuid: "group-1",
				playlistUuid: "playlist-1",
			});

			await service.deleteFilterGroup("group-1", "playlist-1");

			expect(filterGroupsRepository.findOneBy).toHaveBeenCalledWith({
				uuid: "group-1",
			});
			expect(filterGroupsRepository.delete).toHaveBeenCalledWith({
				uuid: "group-1",
			});
		});

		it("throws NotFoundException when the filter group does not exist", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue(null);

			await expect(
				service.deleteFilterGroup("missing", "playlist-1"),
			).rejects.toThrow(NotFoundException);
			expect(filterGroupsRepository.delete).not.toHaveBeenCalled();
		});

		it("throws BadRequestException when the group belongs to another playlist", async () => {
			filterGroupsRepository.findOneBy.mockResolvedValue({
				uuid: "group-1",
				playlistUuid: "other-playlist",
			});

			await expect(
				service.deleteFilterGroup("group-1", "playlist-1"),
			).rejects.toThrow(BadRequestException);
			expect(filterGroupsRepository.delete).not.toHaveBeenCalled();
		});
	});

	describe("runFilters", () => {
		it("removes tracks that no longer match the filters", async () => {
			const groups = [{ uuid: "group-1", filters: [] }];
			filterGroupsRepository.find.mockResolvedValue(groups);
			trackManagerService.findTracksBySmartFilters.mockResolvedValue([
				"t1",
				"t2",
			]);
			playlistTracksRepository.find.mockResolvedValue([
				{ trackUuid: "t1" },
				{ trackUuid: "t3" },
			]);

			await service.runFilters("playlist-1");

			expect(filterGroupsRepository.find).toHaveBeenCalledWith({
				where: { playlistUuid: "playlist-1" },
				relations: { filters: true },
			});
			expect(trackManagerService.findTracksBySmartFilters).toHaveBeenCalledWith(
				groups,
			);
			expect(playlistTracksRepository.find).toHaveBeenCalledWith({
				where: {
					playlistUuid: "playlist-1",
					addedByUuid: expect.any(FindOperator),
				},
				select: ["trackUuid"],
			});
			expect(playlistTracksRepository.delete).toHaveBeenCalledTimes(1);
			const [deleteWhere] = playlistTracksRepository.delete.mock.calls[0];
			expect(deleteWhere.playlistUuid).toBe("playlist-1");
			expect(deleteWhere.trackUuid).toBeInstanceOf(FindOperator);
			expect(deleteWhere.trackUuid.value).toEqual(["t3"]);
			expect(playlistsService.addTracks).toHaveBeenCalledWith(
				"playlist-1",
				["t2"],
				null,
			);
		});

		it("adds tracks that newly match the filters", async () => {
			filterGroupsRepository.find.mockResolvedValue([]);
			trackManagerService.findTracksBySmartFilters.mockResolvedValue([
				"t1",
				"t2",
			]);
			playlistTracksRepository.find.mockResolvedValue([
				{ trackUuid: "t1" },
			]);

			await service.runFilters("playlist-1");

			expect(playlistTracksRepository.delete).not.toHaveBeenCalled();
			expect(playlistsService.addTracks).toHaveBeenCalledTimes(1);
			expect(playlistsService.addTracks).toHaveBeenCalledWith(
				"playlist-1",
				["t2"],
				null,
			);
		});

		it("does nothing when the playlist tracks already match", async () => {
			filterGroupsRepository.find.mockResolvedValue([]);
			trackManagerService.findTracksBySmartFilters.mockResolvedValue([
				"t1",
			]);
			playlistTracksRepository.find.mockResolvedValue([
				{ trackUuid: "t1" },
			]);

			await service.runFilters("playlist-1");

			expect(playlistTracksRepository.delete).not.toHaveBeenCalled();
			expect(playlistsService.addTracks).not.toHaveBeenCalled();
		});

		it("removes tracks in batches of 500", async () => {
			const existing = Array.from({ length: 600 }, (_, i) => `t${i}`);
			filterGroupsRepository.find.mockResolvedValue([]);
			trackManagerService.findTracksBySmartFilters.mockResolvedValue([]);
			playlistTracksRepository.find.mockResolvedValue(
				existing.map((trackUuid) => ({ trackUuid })),
			);

			await service.runFilters("playlist-1");

			expect(playlistTracksRepository.delete).toHaveBeenCalledTimes(2);
			const [firstWhere] = playlistTracksRepository.delete.mock.calls[0];
			const [secondWhere] = playlistTracksRepository.delete.mock.calls[1];
			expect(firstWhere.trackUuid.value).toEqual(existing.slice(0, 500));
			expect(secondWhere.trackUuid.value).toEqual(existing.slice(500));
			expect(playlistsService.addTracks).not.toHaveBeenCalled();
		});

		it("adds tracks in batches of 500", async () => {
			const matching = Array.from({ length: 600 }, (_, i) => `t${i}`);
			filterGroupsRepository.find.mockResolvedValue([]);
			trackManagerService.findTracksBySmartFilters.mockResolvedValue(
				matching,
			);
			playlistTracksRepository.find.mockResolvedValue([]);

			await service.runFilters("playlist-1");

			expect(playlistsService.addTracks).toHaveBeenCalledTimes(2);
			expect(playlistsService.addTracks).toHaveBeenNthCalledWith(
				1,
				"playlist-1",
				matching.slice(0, 500),
				null,
			);
			expect(playlistsService.addTracks).toHaveBeenNthCalledWith(
				2,
				"playlist-1",
				matching.slice(500),
				null,
			);
			expect(playlistTracksRepository.delete).not.toHaveBeenCalled();
		});
	});
});
