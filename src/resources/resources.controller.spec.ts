import { ResourcesController } from "./resources.controller";

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn().mockReturnValue("image/png"),
	},
}));

jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
}));

import { readFile } from "fs/promises";

describe("ResourcesController", () => {
	let controller: ResourcesController;
	let mockResourcesService: {
		sanitizeDimension: jest.Mock;
		resizeImage: jest.Mock;
	};
	let mockRes: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockResourcesService = {
			sanitizeDimension: jest.fn().mockReturnValue(null),
			resizeImage: jest.fn().mockResolvedValue(Buffer.from("webp")),
		};
		mockRes = {
			type: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
			status: jest.fn().mockReturnThis(),
		};
		controller = new ResourcesController(mockResourcesService as any);
	});

	it("serves file without resize", async () => {
		(readFile as jest.Mock).mockResolvedValue(Buffer.from("imgdata"));

		await controller.get(
			mockRes,
			"abc",
			"file.png",
			undefined,
			undefined,
		);

		expect(mockRes.type).toHaveBeenCalledWith("image/png");
		expect(mockRes.send).toHaveBeenCalledWith(Buffer.from("imgdata"));
	});

	it("returns 404 for invalid dir length", async () => {
		await controller.get(mockRes, "ab", "file.png");
		expect(mockRes.status).toHaveBeenCalledWith(404);
	});

	it("resizes when width provided", async () => {
		(readFile as jest.Mock).mockResolvedValue(Buffer.from("imgdata"));
		mockResourcesService.sanitizeDimension
			.mockReturnValueOnce(100)
			.mockReturnValueOnce(null);

		await controller.get(mockRes, "abc", "file.png", "100", undefined);

		expect(mockResourcesService.resizeImage).toHaveBeenCalledWith(
			Buffer.from("imgdata"),
			{ width: 100, height: null },
		);
		expect(mockRes.type).toHaveBeenCalledWith("image/webp");
	});
});
