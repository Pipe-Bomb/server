jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In, Not } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IdentifiersService } from "./identifiers.service";
import { DBIdentity } from "./entities/identity.entity";
import { DisabledIdentifiersService } from "./disabled-identifiers.service";
import { ArtistManagerService } from "src/artist-manager/artist-manager.service";
import { AlbumManagerService } from "src/album-manager/album-manager.service";
import { TrackManagerService } from "src/track-manager/track-manager.service";
import { DBTrack } from "src/tracks/entities/track.entity";

describe("IdentifiersService", () => {
	let service: IdentifiersService;
	let identitiesRepository: {
		findBy: jest.Mock;
		find: jest.Mock;
		delete: jest.Mock;
		createQueryBuilder: jest.Mock;
		deleteAll: jest.Mock;
	};
	let trackManagerService: { find: jest.Mock };
	let emitter: { emit: jest.Mock };

	const track = { uuid: "track-1" } as unknown as DBTrack;

	const identity = (value: string) => ({
		pluginId: "p",
		identifierId: "i",
		ordinal: 0,
		identity: value,
	});

	beforeEach(async () => {
		const queryBuilder = {
			distinct: jest.fn().mockReturnThis(),
			select: jest.fn().mockReturnThis(),
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			delete: jest.fn().mockReturnThis(),
			getRawMany: jest.fn().mockResolvedValue([]),
			execute: jest.fn().mockResolvedValue({}),
		};

		identitiesRepository = {
			findBy: jest.fn(),
			find: jest.fn().mockResolvedValue([]),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => queryBuilder),
			deleteAll: jest.fn(),
		};
		trackManagerService = { find: jest.fn() };
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				IdentifiersService,
				{
					provide: getRepositoryToken(DBIdentity),
					useValue: identitiesRepository,
				},
				{ provide: DisabledIdentifiersService, useValue: {} },
				{ provide: ArtistManagerService, useValue: {} },
				{ provide: AlbumManagerService, useValue: {} },
				{ provide: TrackManagerService, useValue: trackManagerService },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<IdentifiersService>(IdentifiersService);
	});

	it("emits track.identities.updated when identities change", async () => {
		identitiesRepository.findBy
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([identity("a")]);

		await service.identifyTrack(track, {} as any);

		expect(emitter.emit).toHaveBeenCalledTimes(1);
		expect(emitter.emit).toHaveBeenCalledWith(
			"track.identities.updated",
			track,
		);
	});

	it("does not emit track.identities.updated when identities are unchanged", async () => {
		identitiesRepository.findBy
			.mockResolvedValueOnce([identity("a")])
			.mockResolvedValueOnce([identity("a")]);

		await service.identifyTrack(track, {} as any);

		expect(emitter.emit).not.toHaveBeenCalled();
	});

	it("emits track.identities.updated for tracks affected by clean()", async () => {
		identitiesRepository.find.mockResolvedValue([{ trackUuid: "track-1" }]);
		trackManagerService.find.mockResolvedValue([track]);

		await service.clean();

		expect(identitiesRepository.deleteAll).toHaveBeenCalled();
		expect(trackManagerService.find).toHaveBeenCalled();
		expect(emitter.emit).toHaveBeenCalledWith(
			"track.identities.updated",
			track,
		);
	});

	it("clean() deletes only stale identities for registered plugins", async () => {
		service.register(
			{
				id: "i",
				getDependencies: () => [],
				getSoftDependencies: () => [],
			} as never,
			{ package: { name: "p" } } as never,
		);

		await service.clean();

		expect(identitiesRepository.deleteAll).not.toHaveBeenCalled();
		expect(identitiesRepository.delete).toHaveBeenCalledWith({
			pluginId: Not(In(["p"])),
		});
		expect(identitiesRepository.delete).toHaveBeenCalledWith({
			pluginId: "p",
			identifierId: Not(In(["i"])),
		});
	});
});
