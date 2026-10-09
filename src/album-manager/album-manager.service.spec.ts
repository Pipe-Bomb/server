jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AlbumManagerService } from "./album-manager.service";
import { DBAlbum } from "src/albums/entity/album.entity";
import { DBAlbumArtist } from "src/albums/entity/album-artist.entity";
import { DBAlbumIdentity } from "src/albums/entity/album-identity.entity";
import { DBAlbumTrack } from "src/albums/entity/album-track.entity";
import { DBTrack } from "src/tracks/entities/track.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";

function makeQueryBuilder() {
	const qb: Record<string, jest.Mock> = {};
	for (const method of [
		"distinct",
		"select",
		"from",
		"where",
		"andWhere",
		"delete",
		"subQuery",
	]) {
		qb[method] = jest.fn(() => qb);
	}
	qb.getRawMany = jest.fn().mockResolvedValue([]);
	qb.getQuery = jest.fn(() => "SUBQUERY");
	qb.execute = jest.fn().mockResolvedValue({});
	return qb;
}

describe("AlbumManagerService", () => {
	let service: AlbumManagerService;
	let albumsRepository: {
		findBy: jest.Mock;
		createQueryBuilder: jest.Mock;
		manager: { createQueryBuilder: jest.Mock };
	};
	let albumArtistsRepository: {
		findBy: jest.Mock;
		find: jest.Mock;
		delete: jest.Mock;
		insert: jest.Mock;
		update: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let albumIdentitiesRepository: {
		findOne: jest.Mock;
		find: jest.Mock;
		create: jest.Mock;
		delete: jest.Mock;
		createQueryBuilder: jest.Mock;
		deleteAll: jest.Mock;
	};
	let albumTracksRepository: {
		findBy: jest.Mock;
		delete: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let emitter: { emit: jest.Mock };
	let queryBuilder: ReturnType<typeof makeQueryBuilder>;
	let transactionRepo: {
		create: jest.Mock;
		save: jest.Mock;
		delete: jest.Mock;
		insert: jest.Mock;
	};

	const track = { uuid: "track-1" } as unknown as DBTrack;
	const album = { uuid: "al1" } as unknown as DBAlbum;

	const trackLink = {
		albumUuid: "al1",
		pluginId: "p",
		identifierId: "i",
		discNumber: 1,
		trackNumber: 0,
	};
	const artistLink = {
		artistUuid: "ar1",
		pluginId: "p",
		identifierId: "i",
		ordinal: 0,
		joinPhrase: null as string | null,
	};

	beforeEach(async () => {
		queryBuilder = makeQueryBuilder();

		albumsRepository = {
			findBy: jest.fn().mockResolvedValue([]),
			createQueryBuilder: jest.fn(() => queryBuilder),
			manager: { createQueryBuilder: jest.fn(() => queryBuilder) },
		};
		albumArtistsRepository = {
			findBy: jest.fn().mockResolvedValue([]),
			find: jest.fn().mockResolvedValue([]),
			delete: jest.fn(),
			insert: jest.fn(),
			update: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
		};
		albumIdentitiesRepository = {
			findOne: jest.fn(),
			find: jest.fn().mockResolvedValue([]),
			create: jest.fn((value: unknown) => value),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
			deleteAll: jest.fn(),
		};
		albumTracksRepository = {
			findBy: jest.fn().mockResolvedValue([]),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
		};
		emitter = { emit: jest.fn() };

		transactionRepo = {
			create: jest.fn((value: unknown) => value ?? {}),
			save: jest.fn((value: { uuid?: string }) => ({
				...value,
				uuid: value.uuid ?? "new-album",
				dateAdded: 0,
			})),
			delete: jest.fn(),
			insert: jest.fn(),
		};

		const dataSource = {
			transaction: jest.fn((cb: (tm: unknown) => unknown) =>
				cb({ getRepository: () => transactionRepo }),
			),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AlbumManagerService,
				{ provide: getRepositoryToken(DBAlbum), useValue: albumsRepository },
				{
					provide: getRepositoryToken(DBAlbumArtist),
					useValue: albumArtistsRepository,
				},
				{
					provide: getRepositoryToken(DBAlbumIdentity),
					useValue: albumIdentitiesRepository,
				},
				{
					provide: getRepositoryToken(DBAlbumTrack),
					useValue: albumTracksRepository,
				},
				{ provide: DataSource, useValue: dataSource },
				{ provide: ExternalUrlsService, useValue: {} },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<AlbumManagerService>(AlbumManagerService);
	});

	it("emits track.albums.updated and album.tracklist.updated when links change", async () => {
		albumTracksRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([trackLink]);
		albumsRepository.findBy.mockResolvedValue([album]);

		await service.setTrackLinks(track, ["al1"], "p", "i");

		expect(emitter.emit).toHaveBeenCalledWith("track.albums.updated", track);
		expect(emitter.emit).toHaveBeenCalledWith("album.tracklist.updated", album);
	});

	it("does not emit when track links are unchanged", async () => {
		albumTracksRepository.findBy
			.mockResolvedValueOnce([trackLink])
			.mockResolvedValueOnce([{ ...trackLink }]);

		await service.setTrackLinks(track, ["al1"], "p", "i");

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits album.tracklist.updated when track links are cleared", async () => {
		albumTracksRepository.findBy
			.mockResolvedValueOnce([trackLink])
			.mockResolvedValueOnce([]);
		albumsRepository.findBy.mockResolvedValue([album]);

		await service.clearTrackLinks(track, "p", "i");

		expect(emitter.emit).toHaveBeenCalledWith("album.tracklist.updated", album);
	});

	it("emits album.added when resolveAlbum creates an album", async () => {
		albumIdentitiesRepository.findOne.mockResolvedValue(null);

		await service.resolveAlbum("p", "i", "value", true);

		expect(emitter.emit).toHaveBeenCalledWith(
			"album.added",
			expect.objectContaining({ uuid: "new-album" }),
		);
	});

	it("emits album.removed for orphaned albums", async () => {
		queryBuilder.getRawMany.mockResolvedValueOnce([{ uuid: "al1" }]);
		albumsRepository.findBy.mockResolvedValue([album]);

		await service.removeOrphanedAlbums();

		expect(emitter.emit).toHaveBeenCalledWith("album.removed", album);
	});

	it("emits album.identities.updated and album.artists.updated from cleanIdentities", async () => {
		service.registerIdentifier(
			{
				id: "aid",
				getDependencies: () => [],
				getSoftDependencies: () => [],
			} as any,
			{ package: { name: "p" } } as any,
		);

		albumIdentitiesRepository.find.mockResolvedValue([{ albumUuid: "al1" }]);
		albumArtistsRepository.find.mockResolvedValue([{ albumUuid: "al1" }]);
		albumsRepository.findBy.mockResolvedValue([album]);

		await service.cleanIdentities();

		expect(emitter.emit).toHaveBeenCalledWith(
			"album.identities.updated",
			album,
		);
		expect(emitter.emit).toHaveBeenCalledWith("album.artists.updated", album);
	});

	it("emits album.artists.updated when artist links change", async () => {
		albumArtistsRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([artistLink]);

		await service.setArtistLinks(album, ["ar1"], "p", "i");

		expect(emitter.emit).toHaveBeenCalledWith("album.artists.updated", album);
	});

	it("emits album.artists.updated when a join phrase changes", async () => {
		albumArtistsRepository.findBy
			.mockResolvedValueOnce([{ ...artistLink }])
			.mockResolvedValueOnce([{ ...artistLink, joinPhrase: " & " }]);

		await service.setJoinPhrase(album, "ar1", " & ");

		expect(emitter.emit).toHaveBeenCalledWith("album.artists.updated", album);
	});
});
