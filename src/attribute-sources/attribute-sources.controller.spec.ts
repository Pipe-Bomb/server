import { AttributeSourcesController } from "./attribute-sources.controller";

describe("AttributeSourcesController", () => {
	let controller: AttributeSourcesController;
	let mockAttributeSourcesService: any;
	let mockPrivilegesService: any;

	const source = {
		plugin: { package: { name: "plug" } },
		source: { id: "src", getName: () => "Source Name" },
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockAttributeSourcesService = {
			getSources: jest.fn(),
			setSourceOrder: jest.fn(),
		};
		mockPrivilegesService = {
			registerPrivilege: jest.fn(),
		};

		controller = new AttributeSourcesController(
			mockAttributeSourcesService,
			mockPrivilegesService,
		);
	});

	it("registers the edit-attribute-source-order privilege", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"edit-attribute-source-order",
		);
	});

	describe("getAll", () => {
		it("returns the loaded sources as responses", () => {
			mockAttributeSourcesService.getSources.mockReturnValue([source]);

			expect(controller.getAll()).toEqual([
				{ pluginId: "plug", sourceId: "src", name: "Source Name" },
			]);
		});
	});

	describe("setOrder", () => {
		it("applies the new order and returns the updated list", () => {
			mockAttributeSourcesService.getSources.mockReturnValue([source]);
			const body = { sources: [{ pluginId: "plug", sourceId: "src" }] };

			const result = controller.setOrder(body as any);

			expect(mockAttributeSourcesService.setSourceOrder).toHaveBeenCalledWith(
				body.sources,
			);
			expect(result).toEqual([
				{ pluginId: "plug", sourceId: "src", name: "Source Name" },
			]);
		});
	});
});
