jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ArtistManagerService } from "./artist-manager.service";
import { DBArtist } from "./entity/artist.entity";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";
import { ExternalUrlsService } from "src/external-urls/external-urls.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

describe("ArtistManagerService", () => {
	let service: ArtistManagerService;
	let trackArtistsRepository: {
		findBy: jest.Mock;
		delete: jest.Mock;
		insert: jest.Mock;
		update: jest.Mock;
	};
	let emitter: { emit: jest.Mock };

	const track = { uuid: "track-1" } as any;

	beforeEach(async () => {
		trackArtistsRepository = {
			findBy: jest.fn(),
			delete: jest.fn(),
			insert: jest.fn(),
			update: jest.fn(),
		};
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ArtistManagerService,
				{ provide: getRepositoryToken(DBArtist), useValue: {} },
				{ provide: getRepositoryToken(DBArtistIdentity), useValue: {} },
				{
					provide: getRepositoryToken(DBTrackArtist),
					useValue: trackArtistsRepository,
				},
				{ provide: ExternalUrlsService, useValue: {} },
				{ provide: TrackManagerService, useValue: {} },
				{ provide: AlbumManagerService, useValue: {} },
				{ provide: DataSource, useValue: {} },
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

		expect(emitter.emit).toHaveBeenCalledTimes(1);
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

	it("emits track.artists.updated when a join phrase changes", async () => {
		trackArtistsRepository.findBy
			.mockResolvedValueOnce([
				{
					artistUuid: "a1",
					pluginId: "p",
					identifierId: "i",
					ordinal: 0,
					joinPhrase: null,
				},
			])
			.mockResolvedValueOnce([
				{
					artistUuid: "a1",
					pluginId: "p",
					identifierId: "i",
					ordinal: 0,
					joinPhrase: " & ",
				},
			]);

		await service.setJoinPhrase(track, "a1", " & ");

		expect(emitter.emit).toHaveBeenCalledWith("track.artists.updated", track);
	});
});
