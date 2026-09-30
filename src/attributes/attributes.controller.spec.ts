import { AttributesController } from "./attributes.controller";
import { AttributeType } from "./enum/attribute-type.enum";

describe("AttributesController", () => {
	let controller: AttributesController;
	let mockAttributesService: any;
	let mockAttributeUploadService: any;
	let mockAttributeSourcesService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockAttributesService = {};
		mockAttributeUploadService = {
			resolveSession: jest.fn(),
		};
		mockAttributeSourcesService = {
			getTrackAttributes: jest.fn(),
			getArtistAttributes: jest.fn(),
			getAlbumAttributes: jest.fn(),
		};

		controller = new AttributesController(
			mockAttributesService,
			mockAttributeUploadService,
			mockAttributeSourcesService,
		);
	});

	describe("getAllAttributes", () => {
		it("returns all registered attributes grouped by entity type", () => {
			const source = {
				plugin: { package: { name: "plug" } },
				source: { id: "src" },
			};
			mockAttributeSourcesService.getTrackAttributes.mockReturnValue([
				{
					attribute: {
						key: "duration",
						type: "integer",
						supportsMultiple: false,
					},
					source,
				},
			]);
			mockAttributeSourcesService.getArtistAttributes.mockReturnValue([
				{
					attribute: { key: "country", type: "string", supportsMultiple: true },
					source,
				},
			]);
			mockAttributeSourcesService.getAlbumAttributes.mockReturnValue([]);

			const result = controller.getAllAttributes();

			expect(result).toEqual({
				track: [
					{
						pluginId: "plug",
						sourceId: "src",
						key: "duration",
						type: AttributeType.INTEGER,
						supportsMultiple: false,
					},
				],
				artist: [
					{
						pluginId: "plug",
						sourceId: "src",
						key: "country",
						type: AttributeType.STRING,
						supportsMultiple: true,
					},
				],
				album: [],
			});
		});
	});

	describe("uploadAttributeBuffer", () => {
		it("forwards the uploaded buffer to the upload service", async () => {
			const file = { buffer: Buffer.from("data") } as any;
			const user = { id: "user-1" } as any;

			await controller.uploadAttributeBuffer("uuid-1", file, user);

			expect(mockAttributeUploadService.resolveSession).toHaveBeenCalledWith(
				"uuid-1",
				Buffer.from("data"),
				user,
			);
		});
	});

	describe("toResponse", () => {
		it("maps a custom attribute to empty plugin and source ids", () => {
			const result = controller.toResponse({
				attribute: { key: "k", type: "boolean", supportsMultiple: false },
				source: null,
			} as any);

			expect(result).toEqual({
				pluginId: "",
				sourceId: "",
				key: "k",
				type: AttributeType.BOOLEAN,
				supportsMultiple: false,
			});
		});
	});
});
