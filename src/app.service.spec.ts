jest.mock("./libraries/libraries.service", () => ({
	LibrariesService: class {},
}));
jest.mock("./identifiers/identifiers.service", () => ({
	IdentifiersService: class {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { AppService } from "./app.service";
import { IdentifiersService } from "./identifiers/identifiers.service";
import { LibrariesService } from "./libraries/libraries.service";

describe("AppService", () => {
	let service: AppService;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AppService,
				{ provide: LibrariesService, useValue: {} },
				{ provide: IdentifiersService, useValue: {} },
			],
		}).compile();
		service = module.get(AppService);
	});

	it("constructs with the library and identifier services", () => {
		expect(service).toBeInstanceOf(AppService);
	});

	it("schedules no async work on construction", () => {
		// The (currently commented-out) constructor used setTimeout.
		const timers = jest.spyOn(globalThis, "setTimeout");
		try {
			new AppService({} as LibrariesService, {} as IdentifiersService);
			expect(timers).not.toHaveBeenCalled();
		} finally {
			timers.mockRestore();
		}
	});
});
