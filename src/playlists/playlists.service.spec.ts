jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PlaylistsService } from "./playlists.service";
import { DBPlaylist } from "./entity/playlist.entity";
import { DBPlaylistTrack } from "./entity/playlist-track.entity";
import { DBPlaylistMember } from "./entity/playlist-member.entity";
import { PlaylistVisibility } from "./enum/playlist-visibility.enum";
import { PlaylistMemberRole } from "./enum/playlist-member-role.enum";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { AttributeUploadService } from "src/attributes/attribute-upload.service";

describe("PlaylistsService", () => {
	let service: PlaylistsService;
	let playlistsRepository: {
		create: jest.Mock;
		insert: jest.Mock;
		update: jest.Mock;
		remove: jest.Mock;
		findOne: jest.Mock;
	};
	let playlistTracksRepository: {
		findBy: jest.Mock;
		upsert: jest.Mock;
		delete: jest.Mock;
	};
	let membersRepository: {
		findOne: jest.Mock;
		upsert: jest.Mock;
		delete: jest.Mock;
		findOneOrFail: jest.Mock;
	};
	let attributeSourcesService: {
		registerPlaylistAttribute: jest.Mock;
		getPlaylistAttributes: jest.Mock;
		getPlaylistAttributeRows: jest.Mock;
		createPlaylistAttributes: jest.Mock;
		upsertPlaylistAttributes: jest.Mock;
	};
	let emitter: { emit: jest.Mock };
	let playlist: DBPlaylist;

	const row = (value: string) => ({
		pluginId: "",
		sourceId: "",
		key: "title",
		ordinal: 0,
		value_string: value,
		value_int: null,
		value_decimal: null,
		value_boolean: null,
		value_buffer: null,
	});

	beforeEach(async () => {
		playlistsRepository = {
			create: jest.fn((value: unknown) => ({
				uuid: "pl1",
				...(value as object),
			})),
			insert: jest.fn(),
			update: jest.fn(),
			remove: jest.fn(),
			findOne: jest.fn(),
		};
		playlistTracksRepository = {
			findBy: jest.fn().mockResolvedValue([]),
			upsert: jest.fn(),
			delete: jest.fn(),
		};
		membersRepository = {
			findOne: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			findOneOrFail: jest.fn(),
		};
		attributeSourcesService = {
			registerPlaylistAttribute: jest.fn(),
			getPlaylistAttributes: jest.fn(() => []),
			getPlaylistAttributeRows: jest.fn().mockResolvedValue([]),
			createPlaylistAttributes: jest.fn().mockResolvedValue([]),
			upsertPlaylistAttributes: jest.fn(),
		};
		emitter = { emit: jest.fn() };
		playlist = {
			uuid: "pl1",
			visibility: PlaylistVisibility.PUBLIC,
		} as unknown as DBPlaylist;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PlaylistsService,
				{
					provide: getRepositoryToken(DBPlaylist),
					useValue: playlistsRepository,
				},
				{
					provide: getRepositoryToken(DBPlaylistTrack),
					useValue: playlistTracksRepository,
				},
				{
					provide: getRepositoryToken(DBPlaylistMember),
					useValue: membersRepository,
				},
				{ provide: AttributeSourcesService, useValue: attributeSourcesService },
				{ provide: UserManagerService, useValue: {} },
				{ provide: AttributeUploadService, useValue: {} },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<PlaylistsService>(PlaylistsService);
	});

	it("emits playlist.added on create", async () => {
		const created = await service.create(null, null, []);

		expect(emitter.emit).toHaveBeenCalledWith("playlist.added", created);
	});

	it("emits playlist.removed on delete", async () => {
		await service.delete(playlist);

		expect(emitter.emit).toHaveBeenCalledWith("playlist.removed", playlist);
	});

	it("emits playlist.visibility.updated when visibility changes", async () => {
		await service.setVisibility(playlist, PlaylistVisibility.PRIVATE);

		expect(playlistsRepository.update).toHaveBeenCalled();
		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.visibility.updated",
			playlist,
		);
	});

	it("does not emit playlist.visibility.updated when unchanged", async () => {
		await service.setVisibility(playlist, PlaylistVisibility.PUBLIC);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits playlist.members.updated when a role changes", async () => {
		membersRepository.findOne.mockResolvedValue({
			role: PlaylistMemberRole.VIEWER,
		});
		membersRepository.findOneOrFail.mockResolvedValue({});

		await service.upsertMember(playlist, "u1", PlaylistMemberRole.COLLABORATOR);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.members.updated",
			playlist,
		);
	});

	it("does not emit playlist.members.updated when the role is unchanged", async () => {
		membersRepository.findOne.mockResolvedValue({
			role: PlaylistMemberRole.COLLABORATOR,
		});
		membersRepository.findOneOrFail.mockResolvedValue({});

		await service.upsertMember(playlist, "u1", PlaylistMemberRole.COLLABORATOR);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits playlist.members.updated when a member is removed", async () => {
		membersRepository.delete.mockResolvedValue({ affected: 1 });

		await service.removeMember(playlist, "u1");

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.members.updated",
			playlist,
		);
	});

	it("emits playlist.tracklist.updated when tracks change", async () => {
		playlistTracksRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ trackUuid: "t1", addedByUuid: null, ordinal: 0 },
			]);

		await service.addTracks(playlist, ["t1"], null);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.tracklist.updated",
			playlist,
		);
	});

	it("emits playlist.attributes.updated when attributes change", async () => {
		attributeSourcesService.getPlaylistAttributeRows
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([row("a")]);

		await service.updateAttributes(playlist, [], null);

		expect(emitter.emit).toHaveBeenCalledWith(
			"playlist.attributes.updated",
			playlist,
		);
	});

	it("does not emit playlist.attributes.updated when attributes are unchanged", async () => {
		attributeSourcesService.getPlaylistAttributeRows
			.mockResolvedValueOnce([row("a")])
			.mockResolvedValueOnce([row("a")]);

		await service.updateAttributes(playlist, [], null);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("orders playlist tracks in code instead of via a relation order clause", async () => {
		const tracks = [
			{ trackUuid: "b", dateAdded: 2, ordinal: 0 },
			{ trackUuid: "a", dateAdded: 1, ordinal: 5 },
			{ trackUuid: "c", dateAdded: 1, ordinal: 1 },
		];
		let findOptions: { order?: unknown } | undefined;
		playlistsRepository.findOne.mockImplementation(
			(options: { order?: unknown }) => {
				findOptions = options;
				return Promise.resolve({ tracks, toSavedResponse: () => ({ tracks }) });
			},
		);

		const client = service.createPlaylistClient({} as never);
		await client.getPlaylist("pl1", { relations: { tracks: true } });

		expect(findOptions?.order).toBeUndefined();
		expect(tracks.map((track) => track.trackUuid)).toEqual(["c", "a", "b"]);
	});
});
