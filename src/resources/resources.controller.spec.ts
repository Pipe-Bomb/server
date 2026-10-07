import { NotFoundException } from "@nestjs/common";
import type { Request, Response } from "express";
import { readFile } from "fs/promises";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
}));

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
	},
}));

const readFileMock = readFile as jest.MockedFunction<typeof readFile>;
const getTypeMock = jest.requireMock<{
	default: { getType: jest.Mock };
}>("mime").default.getType;

function createResponse() {
	const res = {
		set: jest.fn(),
		status: jest.fn(),
		end: jest.fn(),
		type: jest.fn(),
		send: jest.fn(),
	};
	res.status.mockReturnValue(res);
	res.type.mockReturnValue(res);
	return res;
}

function createRequest(headers: Record<string, string> = {}) {
	return {
		method: "GET",
		path: "/resources/abc/file.png",
		headers,
	} as unknown as Request;
}

describe("ResourcesController", () => {
	let controller: ResourcesController;
	let service: {
		resolveResourcePath: jest.Mock;
		sanitizeDimension: jest.Mock;
		resizeImage: jest.Mock;
	};

	beforeEach(() => {
		readFileMock.mockReset();
		getTypeMock.mockReset();
		getTypeMock.mockReturnValue(null);
		service = {
			resolveResourcePath: jest.fn(),
			sanitizeDimension: jest.fn().mockReturnValue(null),
			resizeImage: jest.fn(),
		};
		controller = new ResourcesController(
			service as unknown as ResourcesService,
		);
	});

	it("throws NotFound for an invalid path", async () => {
		service.resolveResourcePath.mockReturnValue(null);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"ab",
				"file.png",
			),
		).rejects.toThrow(NotFoundException);
		expect(readFileMock).not.toHaveBeenCalled();
	});

	it("throws NotFound when the file is missing", async () => {
		service.resolveResourcePath.mockReturnValue("/tmp/missing.png");
		readFileMock.mockRejectedValue(
			Object.assign(new Error("no such file"), { code: "ENOENT" }),
		);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
			),
		).rejects.toThrow(NotFoundException);
	});

	it("serves originals with cache headers and octet-stream for unknown mime types", async () => {
		service.resolveResourcePath.mockReturnValue("/tmp/file.zzzq");
		readFileMock.mockResolvedValue(Buffer.from("data"));
		const res = createResponse();

		await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.zzzq",
		);

		expect(res.set).toHaveBeenCalledWith({
			"Cache-Control": "public, max-age=31536000, immutable",
			ETag: '"file.zzzq"',
		});
		expect(res.type).toHaveBeenCalledWith("application/octet-stream");
		expect(res.send).toHaveBeenCalled();
	});

	it("resizes and serves webp with a dimension-specific etag", async () => {
		const resized = Buffer.from("resized");
		service.resolveResourcePath.mockReturnValue("/tmp/file.png");
		service.sanitizeDimension.mockImplementation((value: unknown) =>
			value === "100" ? 100 : null,
		);
		service.resizeImage.mockResolvedValue(resized);
		readFileMock.mockResolvedValue(Buffer.from("original"));
		const res = createResponse();

		await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.png",
			"100",
			undefined,
		);

		expect(service.resizeImage).toHaveBeenCalledWith(Buffer.from("original"), {
			width: 100,
			height: null,
		});
		expect(res.set).toHaveBeenCalledWith({
			"Cache-Control": "public, max-age=31536000, immutable",
			ETag: '"file.png:100x0"',
		});
		expect(res.type).toHaveBeenCalledWith("image/webp");
		expect(res.send).toHaveBeenCalledWith(resized);
	});

	it("returns 304 without reading the file when the etag matches", async () => {
		service.resolveResourcePath.mockReturnValue("/tmp/file.png");
		const res = createResponse();

		await controller.get(
			createRequest({ "if-none-match": '"file.png"' }),
			res as unknown as Response,
			"abc",
			"file.png",
		);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.end).toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
		expect(readFileMock).not.toHaveBeenCalled();
	});
});
