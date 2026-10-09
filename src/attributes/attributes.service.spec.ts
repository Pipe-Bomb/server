jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AttributesService } from "./attributes.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBAlbum } from "src/albums/entity/album.entity";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { TasksService } from "src/tasks/tasks.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

describe("AttributesService", () => {
	let service: AttributesService;
	let attributeSourcesService: {
		getSources: jest.Mock;
		getTrackAttributeRows: jest.Mock;
		getArtistAttributeRows: jest.Mock;
		getAlbumAttributeRows: jest.Mock;
		upsertTrackAttributes: jest.Mock;
		upsertArtistAttributes: jest.Mock;
		replaceAllArtistAttributes: jest.Mock;
		replaceAllAlbumAttributes: jest.Mock;
	};
	let emitter: { emit: jest.Mock };

	const track = { uuid: "track-1" } as unknown as DBTrack;

	const row = (value: string) => ({
		pluginId: "p",
		sourceId: "s",
		key: "title",
		ordinal: 0,
		value_string: value,
		value_int: null,
		value_decimal: null,
		value_boolean: null,
		value_buffer: null,
	});

	beforeEach(async () => {
		attributeSourcesService = {
			getSources: jest.fn(() => []),
			getTrackAttributeRows: jest.fn(),
			getArtistAttributeRows: jest.fn(),
			getAlbumAttributeRows: jest.fn(),
			upsertTrackAttributes: jest.fn(),
			upsertArtistAttributes: jest.fn(),
			replaceAllArtistAttributes: jest.fn(),
			replaceAllAlbumAttributes: jest.fn(),
		};
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AttributesService,
				{ provide: AttributeSourcesService, useValue: attributeSourcesService },
				{ provide: TasksService, useValue: { registerSystemTask: jest.fn() } },
				{
					provide: ArtistManagerService,
					useValue: { getInformationHelper: jest.fn() },
				},
				{
					provide: AlbumManagerService,
					useValue: { getInformationHelper: jest.fn() },
				},
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<AttributesService>(AttributesService);
	});

	it("emits track.attributes.updated when attributes change", async () => {
		attributeSourcesService.getTrackAttributeRows
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeTrack(track, {} as any);

		expect(emitter.emit).toHaveBeenCalledTimes(1);
		expect(emitter.emit).toHaveBeenCalledWith(
			"track.attributes.updated",
			track,
		);
	});

	it("does not emit track.attributes.updated when attributes are unchanged", async () => {
		attributeSourcesService.getTrackAttributeRows
			.mockResolvedValueOnce([row("a")])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeTrack(track, {} as any);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits artist.attributes.updated when attributes change", async () => {
		const artist = { uuid: "artist-1" } as unknown as DBArtist;
		attributeSourcesService.getArtistAttributeRows
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeArtist(artist);

		expect(emitter.emit).toHaveBeenCalledWith(
			"artist.attributes.updated",
			artist,
		);
	});

	it("does not emit artist.attributes.updated when attributes are unchanged", async () => {
		const artist = { uuid: "artist-1" } as unknown as DBArtist;
		attributeSourcesService.getArtistAttributeRows
			.mockResolvedValueOnce([row("a")])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeArtist(artist);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits album.attributes.updated when attributes change", async () => {
		const album = { uuid: "album-1" } as unknown as DBAlbum;
		attributeSourcesService.getAlbumAttributeRows
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeAlbum(album);

		expect(emitter.emit).toHaveBeenCalledWith(
			"album.attributes.updated",
			album,
		);
	});

	it("does not emit album.attributes.updated when attributes are unchanged", async () => {
		const album = { uuid: "album-1" } as unknown as DBAlbum;
		attributeSourcesService.getAlbumAttributeRows
			.mockResolvedValueOnce([row("a")])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeAlbum(album);

		expect(emitter.emit).not.toHaveBeenCalled();
	});
});
