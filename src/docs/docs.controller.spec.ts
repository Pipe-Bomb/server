import { Test, TestingModule } from "@nestjs/testing";
import { DocsController } from "./docs.controller";
import { DocsService } from "./docs.service";

const mockDocsService = {
	getDocument: jest.fn(),
};

const doc = { openapi: "3.1.0" };

describe("DocsController", () => {
	let controller: DocsController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DocsController],
			providers: [{ provide: DocsService, useValue: mockDocsService }],
		}).compile();
		controller = module.get(DocsController);
	});

	it("returns the stored document", () => {
		mockDocsService.getDocument.mockReturnValue(doc);

		expect(controller.getJson()).toBe(doc);
		expect(mockDocsService.getDocument).toHaveBeenCalledTimes(1);
	});

	it("returns undefined when no document has been set", () => {
		mockDocsService.getDocument.mockReturnValue(undefined);

		expect(controller.getJson()).toBeUndefined();
	});
});
