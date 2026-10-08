jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AttributesService } from "./attributes.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { TasksService } from "src/tasks/tasks.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";

describe("AttributesService", () => {
	let service: AttributesService;
	let attributeSourcesService: {
		getSources: jest.Mock;
		getTrackAttributeRows: jest.Mock;
		upsertTrackAttributes: jest.Mock;
		upsertArtistAttributes: jest.Mock;
	};
	let emitter: { emit: jest.Mock };

	const track = { uuid: "track-1" } as any;

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
			upsertTrackAttributes: jest.fn(),
			upsertArtistAttributes: jest.fn(),
		};
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AttributesService,
				{ provide: AttributeSourcesService, useValue: attributeSourcesService },
				{ provide: TasksService, useValue: { registerSystemTask: jest.fn() } },
				{ provide: ArtistManagerService, useValue: {} },
				{ provide: AlbumManagerService, useValue: {} },
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
		expect(emitter.emit).toHaveBeenCalledWith("track.attributes.updated", track);
	});

	it("does not emit track.attributes.updated when attributes are unchanged", async () => {
		attributeSourcesService.getTrackAttributeRows
			.mockResolvedValueOnce([row("a")])
			.mockResolvedValueOnce([row("a")]);

		await service.attributeTrack(track, {} as any);

		expect(emitter.emit).not.toHaveBeenCalled();
	});
});
