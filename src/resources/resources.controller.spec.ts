import { NotFoundException, StreamableFile } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { ResourcesController } from "./resources.controller";
import { ResourceManagerService } from "src/resource-manager/resource-manager.service";
import type { BufferAttributeStreamService } from "src/attribute-sources/buffer-attribute-stream.service";

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
	},
}));

jest.mock("fs", () => ({
	...jest.requireActual<typeof import("fs")>("fs"),
	createReadStream: jest.fn(),
}));

jest.mock("fs/promises", () => ({
	...jest.requireActual<typeof import("fs/promises")>("fs/promises"),
	stat: jest.fn(),
}));

const createReadStreamMock = jest.mocked(createReadStream);
const statMock = jest.mocked(stat);

const UUID = "123e4567-e89b-12d3-a456-426614174000";

function createResponse() {
	return {
		set: jest.fn(),
		status: jest.fn(),
	} as unknown as Response;
}

function createRequest() {
	return {
		method: "GET",
		path: "/resources/abc/file.png",
		headers: {},
	} as unknown as Request;
}

function mockReadStream(stream: Readable) {
	createReadStreamMock.mockReturnValue(
		stream as unknown as ReturnType<typeof createReadStream>,
	);
}

describe("ResourcesController", () => {
	let controller: ResourcesController;
	let resourceManager: { resolveResourcePath: jest.Mock };
	let bufferAttributeStream: {
		serve: jest.MockedFunction<BufferAttributeStreamService["serve"]>;
	};

	beforeEach(() => {
		createReadStreamMock.mockReset();
		statMock.mockReset();
		statMock.mockResolvedValue({} as Awaited<ReturnType<typeof stat>>);

		resourceManager = { resolveResourcePath: jest.fn() };
		bufferAttributeStream = {
			serve: jest.fn() as unknown as jest.MockedFunction<
				BufferAttributeStreamService["serve"]
			>,
		};

		controller = new ResourcesController(
			resourceManager as unknown as ResourceManagerService,
			bufferAttributeStream as unknown as BufferAttributeStreamService,
		);
	});

	it("throws NotFound for an invalid path", async () => {
		resourceManager.resolveResourcePath.mockReturnValue(null);

		await expect(
			controller.get(createRequest(), createResponse(), "ab", "file.png", {}),
		).rejects.toThrow(NotFoundException);
		expect(statMock).not.toHaveBeenCalled();
		expect(bufferAttributeStream.serve).not.toHaveBeenCalled();
	});

	it("throws NotFound when the file is missing", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		statMock.mockRejectedValue(
			Object.assign(new Error("no such file"), { code: "ENOENT" }),
		);

		await expect(
			controller.get(createRequest(), createResponse(), "abc", "file.png", {}),
		).rejects.toThrow(NotFoundException);
		expect(bufferAttributeStream.serve).not.toHaveBeenCalled();
	});

	it("delegates raw resources to the stream service", async () => {
		const streamable = new StreamableFile(Readable.from([Buffer.from("x")]));
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		bufferAttributeStream.serve.mockResolvedValue(streamable);
		const req = createRequest();
		const res = createResponse();

		const result = await controller.get(req, res, "abc", "file.png", {});

		expect(statMock).toHaveBeenCalledWith("/tmp/file.png");
		expect(bufferAttributeStream.serve).toHaveBeenCalledWith(
			req,
			res,
			{ uuid: UUID, extension: "png", file: "file.png" },
			expect.any(Function),
			{},
			{
				pluginId: undefined,
				sourceId: undefined,
				entity: undefined,
				key: undefined,
			},
		);
		expect(result).toBe(streamable);
	});

	it("provides a fresh read stream to the service", async () => {
		const stream = Readable.from([Buffer.from("x")]);
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		bufferAttributeStream.serve.mockResolvedValue(undefined);
		mockReadStream(stream);

		await controller.get(
			createRequest(),
			createResponse(),
			"abc",
			"file.png",
			{},
		);

		const getStream = bufferAttributeStream.serve.mock.calls[0][3];
		expect(getStream()).toBe(stream);
		expect(createReadStreamMock).toHaveBeenCalledWith("/tmp/file.png");
	});

	it("forwards formatter control params to the service", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		bufferAttributeStream.serve.mockResolvedValue(undefined);

		await controller.get(
			createRequest(),
			createResponse(),
			"abc",
			"file.png",
			{ width: "100" },
			"plugin",
			"source",
			"track",
			"front",
		);

		expect(bufferAttributeStream.serve).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			{ uuid: UUID, extension: "png", file: "file.png" },
			expect.any(Function),
			{ width: "100" },
			{
				pluginId: "plugin",
				sourceId: "source",
				entity: "track",
				key: "front",
			},
		);
	});
});
