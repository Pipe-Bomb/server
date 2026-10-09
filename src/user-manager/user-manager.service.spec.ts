jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserManagerService } from "./user-manager.service";
import { DBUser } from "src/users/entity/user.entity";
import { SecretsService } from "src/secrets/secrets.service";

describe("UserManagerService", () => {
	let service: UserManagerService;
	let usersRepository: {
		findOneBy: jest.Mock;
		create: jest.Mock;
		insert: jest.Mock;
	};
	let emitter: { emit: jest.Mock };

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn((value: unknown) => value),
			insert: jest.fn(),
		};
		emitter = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserManagerService,
				{ provide: getRepositoryToken(DBUser), useValue: usersRepository },
				{
					provide: SecretsService,
					useValue: {
						getOrCreate: jest.fn(() => "secret"),
						createAuthSecret: jest.fn(() => "secret"),
					},
				},
				{ provide: JwtService, useValue: {} },
				{ provide: EventEmitter2, useValue: emitter },
			],
		}).compile();

		service = module.get<UserManagerService>(UserManagerService);
	});

	it("emits user.added when a user is created", async () => {
		const user = await service.create("Alice", "password123");

		expect(emitter.emit).toHaveBeenCalledWith("user.added", user);
	});
});
