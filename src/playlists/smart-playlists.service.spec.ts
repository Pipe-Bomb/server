jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SmartPlaylistsService } from "./smart-playlists.service";
import { DBPlaylist } from "./entity/playlist.entity";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { DBSmartPlaylistFilter } from "./entity/smart-playlist-filter.entity";
import { DBSmartPlaylistFilterGroup } from "./entity/smart-playlist-filter-group.entity";
import { PlaylistsService } from "./playlists.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { TasksService } from "src/tasks/tasks.service";

describe("SmartPlaylistsService", () => {
	let service: SmartPlaylistsService;
	let filterGroupsRepository: {
		create: jest.Mock;
		save: jest.Mock;
		findOneBy: jest.Mock;
		delete: jest.Mock;
		find: jest.Mock;
	};
	let filtersRepository: {
		insert: jest.Mock;
		delete: jest.Mock;
		findBy: jest.Mock;
		create: jest.Mock;
	};
	let playlistsService: { addTracks: jest.Mock; removeTracks: jest.Mock };
	let trackManagerService: { findTracksBySmartFilters: jest.Mock };
	let emitter: { emit: jest.Mock };

	const playlist = { uuid: "pl1" } as unknown as DBPlaylist;

	beforeEach(async () => {
		filterGroupsRepository = {
			create: jest.fn((value: unknown) => ({
				uuid: "g1",
				...(value as object),
			})),
			save: jest.fn(),
			findOneBy: jest.fn(),
			delete: jest.fn(),
			find: jest.fn().mockResolvedValue([]),
		};
		filtersRepository = {
			insert: jest.fn(),
			delete: jest.fn(),
			findBy: jest.fn().mockResolvedValue([]),
			create: jest.fn((value: unknown) => value ?? {}),
		};
		playlistsService = { addTracks: jest.fn(), removeTracks: jest.fn() };
		trackManagerService = { findTracksBySmartFilters: jest.fn() };
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SmartPlaylistsService,
				{ provide: getRepositoryToken(DBPlaylist), useValue: {} },
				{
					provide: getRepositoryToken(DBSmartPlaylistFilterGroup),
					useValue: filterGroupsRepository,
				},
				{
					provide: getRepositoryToken(DBSmartPlaylistFilter),
					useValue: filtersRepository,
				},
				{
					provide: getRepositoryToken(DBPlaylistTrack),
					useValue: { find: jest.fn().mockResolvedValue([]) },
				},
				{ provide: PlaylistsService, useValue: playlistsService },
				{ provide: TrackManagerService, useValue: trackManagerService },
				{ provide: TasksService, useValue: { registerSystemTask: jest.fn() } },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<SmartPlaylistsService>(SmartPlaylistsService);
	});

	it("emits playlist.filters.updated when a filter group is added", async () => {
		await service.addFilterGroup(playlist, [
			{
				entityType: "track",
				attributeKey: "title",
				attributeType: "string",
			} as any,
		]);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.filters.updated",
			playlist,
		);
	});

	it("emits playlist.filters.updated when a filter group is updated", async () => {
		filterGroupsRepository.findOneBy.mockResolvedValue({
			uuid: "g1",
			playlistUuid: "pl1",
		});
		filtersRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ entityType: "track", attributeKey: "title" }]);

		await service.updateFilterGroup("g1", playlist, [
			{
				entityType: "track",
				attributeKey: "title",
				attributeType: "string",
			} as any,
		]);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.filters.updated",
			playlist,
		);
	});

	it("emits playlist.filters.updated when a filter group is deleted", async () => {
		filterGroupsRepository.findOneBy.mockResolvedValue({
			uuid: "g1",
			playlistUuid: "pl1",
		});

		await service.deleteFilterGroup("g1", playlist);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.filters.updated",
			playlist,
		);
	});

	it("runFilters delegates adds to playlistsService.addTracks", async () => {
		trackManagerService.findTracksBySmartFilters.mockResolvedValue(["t1"]);

		await service.runFilters(playlist);

		expect(playlistsService.addTracks).toHaveBeenCalledWith(
			playlist,
			["t1"],
			null,
		);
	});
});
