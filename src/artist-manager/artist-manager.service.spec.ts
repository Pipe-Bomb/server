jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ArtistManagerService } from "./artist-manager.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DBArtist } from "./entity/artist.entity";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { ArtistIdentityTarget } from "./enum/artist-identity-target.enum";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

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

describe("ArtistManagerService", () => {
	let service: ArtistManagerService;
	let artistsRepository: {
		findBy: jest.Mock;
		update: jest.Mock;
		createQueryBuilder: jest.Mock;
		manager: { createQueryBuilder: jest.Mock };
	};
	let identitiesRepository: {
		findBy: jest.Mock;
		findOne: jest.Mock;
		create: jest.Mock;
		createQueryBuilder: jest.Mock;
		deleteAll: jest.Mock;
	};
	let trackArtistsRepository: {
		findBy: jest.Mock;
		delete: jest.Mock;
		insert: jest.Mock;
		update: jest.Mock;
		createQueryBuilder: jest.Mock;
	};
	let trackManagerService: { find: jest.Mock };
	let emitter: { emit: jest.Mock };
	let queryBuilder: ReturnType<typeof makeQueryBuilder>;
	let transactionManager: {
		create: jest.Mock;
		save: jest.Mock;
		getRepository: jest.Mock;
	};

	const track = { uuid: "track-1" } as unknown as DBTrack;

	beforeEach(async () => {
		queryBuilder = makeQueryBuilder();

		artistsRepository = {
			findBy: jest.fn(),
			update: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
			manager: { createQueryBuilder: jest.fn(() => queryBuilder) },
		};
		identitiesRepository = {
			findBy: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn((value: unknown) => value),
			createQueryBuilder: jest.fn(() => queryBuilder),
			deleteAll: jest.fn(),
		};
		trackArtistsRepository = {
			findBy: jest.fn(),
			delete: jest.fn(),
			insert: jest.fn(),
			update: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
		};
		trackManagerService = { find: jest.fn() };
		emitter = { emit: jest.fn() };

		transactionManager = {
			create: jest.fn((_entity: unknown, value?: unknown) => value ?? {}),
			save: jest.fn((value: { uuid?: string }) => ({
				...value,
				uuid: value.uuid ?? "new-artist",
				dateAdded: 0,
			})),
			getRepository: jest.fn(() => queryBuilder),
		};

		const dataSource = {
			transaction: jest.fn((cb: (tm: unknown) => unknown) =>
				cb(transactionManager),
			),
			getRepository: jest.fn(() => ({
				findBy: jest.fn().mockResolvedValue([]),
			})),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ArtistManagerService,
				{ provide: getRepositoryToken(DBArtist), useValue: artistsRepository },
				{
					provide: getRepositoryToken(DBArtistIdentity),
					useValue: identitiesRepository,
				},
				{
					provide: getRepositoryToken(DBTrackArtist),
					useValue: trackArtistsRepository,
				},
				{ provide: ExternalUrlsService, useValue: {} },
				{ provide: TrackManagerService, useValue: trackManagerService },
				{ provide: AlbumManagerService, useValue: {} },
				{ provide: DataSource, useValue: dataSource },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<ArtistManagerService>(ArtistManagerService);
	});

	it("emits track.artists.updated when links change", async () => {
		trackArtistsRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					artistUuid: "a1",
					pluginId: "p",
					identifierId: "i",
					ordinal: 0,
					joinPhrase: null,
				},
			]);

		await service.setTrackLinks(track, ["a1"], "p", "i");

		expect(emitter.emit).toHaveBeenCalledWith("track.artists.updated", track);
	});

	it("does not emit track.artists.updated when links are unchanged", async () => {
		const link = {
			artistUuid: "a1",
			pluginId: "p",
			identifierId: "i",
			ordinal: 0,
			joinPhrase: null,
		};
		trackArtistsRepository.findBy
			.mockResolvedValueOnce([link])
			.mockResolvedValueOnce([{ ...link }]);

		await service.setTrackLinks(track, ["a1"], "p", "i");

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits artist.added when resolveArtist creates an artist", async () => {
		identitiesRepository.findOne.mockResolvedValue(null);

		await service.resolveArtist(
			"p",
			"i",
			"value",
			ArtistIdentityTarget.ARTIST,
			true,
		);

		expect(emitter.emit).toHaveBeenCalledWith(
			"artist.added",
			expect.objectContaining({ uuid: "new-artist" }),
		);
	});

	it("emits artist.removed for orphaned artists", async () => {
		queryBuilder.getRawMany.mockResolvedValueOnce([{ uuid: "artist-1" }]);
		artistsRepository.findBy.mockResolvedValue([{ uuid: "artist-1" }]);

		await service.removeOrphanedArtists();

		expect(emitter.emit).toHaveBeenCalledWith("artist.removed", {
			uuid: "artist-1",
		});
	});

	it("emits artist.identities.updated and track.artists.updated from cleanIdentities", async () => {
		service.registerIdentifier(
			{
				id: "aid",
				getDependencies: () => [],
				getSoftDependencies: () => [],
			} as any,
			{ package: { name: "p" } } as any,
		);

		queryBuilder.getRawMany
			.mockResolvedValueOnce([{ artistUuid: "artist-1" }])
			.mockResolvedValueOnce([{ trackUuid: "track-1" }]);
		artistsRepository.findBy.mockResolvedValue([{ uuid: "artist-1" }]);
		trackManagerService.find.mockResolvedValue([track]);

		await service.cleanIdentities();

		expect(emitter.emit).toHaveBeenCalledWith("artist.identities.updated", {
			uuid: "artist-1",
		});
		expect(emitter.emit).toHaveBeenCalledWith("track.artists.updated", track);
	});
});
