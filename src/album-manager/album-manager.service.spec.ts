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
import { ExternalUrlsService } from "src/external-urls/external-urls.service";

describe("AlbumManagerService", () => {
	let service: AlbumManagerService;
	let albumTracksRepository: { findBy: jest.Mock; delete: jest.Mock };
	let transactionRepo: { delete: jest.Mock; insert: jest.Mock; create: jest.Mock };
	let emitter: { emit: jest.Mock };

	const track = { uuid: "track-1" } as any;

	beforeEach(async () => {
		albumTracksRepository = {
			findBy: jest.fn(),
			delete: jest.fn(),
		};
		transactionRepo = {
			delete: jest.fn(),
			insert: jest.fn(),
			create: jest.fn((value) => value),
		};
		emitter = { emit: jest.fn() };

		const dataSource = {
			transaction: jest.fn((cb: any) =>
				cb({ getRepository: () => transactionRepo }),
			),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AlbumManagerService,
				{ provide: getRepositoryToken(DBAlbum), useValue: {} },
				{ provide: getRepositoryToken(DBAlbumArtist), useValue: {} },
				{ provide: getRepositoryToken(DBAlbumIdentity), useValue: {} },
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

	it("emits track.albums.updated when links change", async () => {
		albumTracksRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					albumUuid: "al1",
					pluginId: "p",
					identifierId: "i",
					discNumber: 1,
					trackNumber: 0,
				},
			]);

		await service.setTrackLinks(track, ["al1"], "p", "i");

		expect(emitter.emit).toHaveBeenCalledTimes(1);
		expect(emitter.emit).toHaveBeenCalledWith("track.albums.updated", track);
	});

	it("does not emit track.albums.updated when links are unchanged", async () => {
		const link = {
			albumUuid: "al1",
			pluginId: "p",
			identifierId: "i",
			discNumber: 1,
			trackNumber: 0,
		};
		albumTracksRepository.findBy
			.mockResolvedValueOnce([link])
			.mockResolvedValueOnce([{ ...link }]);

		await service.setTrackLinks(track, ["al1"], "p", "i");

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits track.albums.updated when links are cleared", async () => {
		albumTracksRepository.findBy
			.mockResolvedValueOnce([
				{
					albumUuid: "al1",
					pluginId: "p",
					identifierId: "i",
					discNumber: 1,
					trackNumber: 0,
				},
			])
			.mockResolvedValueOnce([]);

		await service.clearTrackLinks(track, "p", "i");

		expect(emitter.emit).toHaveBeenCalledWith("track.albums.updated", track);
	});
});
