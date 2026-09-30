jest.mock("mime", () => ({
	__esModule: true,
	default: { getType: jest.fn() },
}));

import { NotFoundException, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import { ReadStream } from "fs";
import * as os from "os";
import * as path from "path";
import { Test, TestingModule } from "@nestjs/testing";
import mime from "mime";
import { IconsController } from "./icons.controller";
import { IconsService } from "./icons.service";
import { LoadedIcon } from "./interface/loaded-icon.interface";

const mockIconsService = {
	getIcon: jest.fn(),
};

describe("IconsController", () => {
	let controller: IconsController;
	let tmpDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		jest.clearAllMocks();
		originalCwd = process.cwd();
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "icons-controller-spec-"));
		process.chdir(tmpDir);

		const module: TestingModule = await Test.createTestingModule({
			controllers: [IconsController],
			providers: [{ provide: IconsService, useValue: mockIconsService }],
		}).compile();
		controller = module.get(IconsController);
	});

	afterEach(async () => {
		// Let any lazily opened ReadStream finish opening before the temp
		// dir is removed, so no ENOENT error event fires after the test.
		await new Promise((resolve) => setTimeout(resolve, 25));
		fs.rmSync(tmpDir, { recursive: true, force: true });
		process.chdir(originalCwd);
	});

	it("throws NotFoundException when the icon is missing", () => {
		mockIconsService.getIcon.mockReturnValue(null);
		const set = jest.fn();
		const res = { set } as unknown as Response;

		expect(() => controller.getIcon("plugin", "icon", res)).toThrow(
			new NotFoundException("Icon not found"),
		);
		expect(set).not.toHaveBeenCalled();
	});

	it("streams the icon file with its mime type", () => {
		const iconPath = path.join(tmpDir, "icon.svg");
		fs.writeFileSync(iconPath, "<svg></svg>");
		mockIconsService.getIcon.mockReturnValue({
			id: "icon",
			path: iconPath,
			extension: "svg",
			plugin: null,
		} as LoadedIcon);
		(mime.getType as jest.Mock).mockReturnValue("image/svg+xml");
		const set = jest.fn();
		const res = { set } as unknown as Response;

		const result = controller.getIcon("plugin", "icon", res);

		expect(mockIconsService.getIcon).toHaveBeenCalledWith("plugin", "icon");
		expect(result).toBeInstanceOf(StreamableFile);
		expect(result.getStream()).toBeInstanceOf(ReadStream);
		expect(set).toHaveBeenCalledWith({ "Content-Type": "image/svg+xml" });
	});
});
