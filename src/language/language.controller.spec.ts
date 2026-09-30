import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { LanguageController } from "./language.controller";
import { LanguageService } from "./language.service";

const mockLanguageService = {
	getIds: jest.fn(),
	getMap: jest.fn(),
};

describe("LanguageController", () => {
	let controller: LanguageController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [LanguageController],
			providers: [{ provide: LanguageService, useValue: mockLanguageService }],
		}).compile();
		controller = module.get(LanguageController);
	});

	it("lists the registered language ids", () => {
		mockLanguageService.getIds.mockReturnValue(["en", "fr"]);

		expect(controller.getLanguages()).toEqual(["en", "fr"]);
		expect(mockLanguageService.getIds).toHaveBeenCalledTimes(1);
	});

	it("returns the language map for a known id", () => {
		mockLanguageService.getMap.mockReturnValue({ a: "b" });

		expect(controller.getMap("en")).toEqual({ id: "en", keys: { a: "b" } });
		expect(mockLanguageService.getMap).toHaveBeenCalledWith("en");
	});

	it("throws NotFoundException for an unknown language id", () => {
		mockLanguageService.getMap.mockReturnValue(null);

		expect(() => controller.getMap("nope")).toThrow(
			new NotFoundException("Language map not found"),
		);
	});
});
