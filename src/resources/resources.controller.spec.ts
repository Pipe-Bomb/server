import {
	BadRequestException,
	InternalServerErrorException,
	NotFoundException,
	StreamableFile,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { createHash } from "crypto";
import mime from "mime";
import type { BufferAttributeFormatter } from "@sdk";
import { ResourcesController } from "./resources.controller";
import { ResourceManagerService } from "src/resource-manager/resource-manager.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";

jest.mock("fs", () => ({
	...jest.requireActual<typeof import("fs")>("fs"),
	createReadStream: jest.fn(),
}));

jest.mock("fs/promises", () => ({
	...jest.requireActual<typeof import("fs/promises")>("fs/promises"),
	stat: jest.fn(),
}));

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
	},
}));

const createReadStreamMock = jest.mocked(createReadStream);
const statMock = jest.mocked(stat);
const getTypeMock = (mime as unknown as { getType: jest.Mock }).getType;

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const RAW_CACHE_CONTROL = "public, max-age=31536000, immutable";
const FORMATTED_CACHE_CONTROL = "public, max-age=0, must-revalidate";

function createResponse() {
	const res = {
		set: jest.fn(),
		status: jest.fn(),
		end: jest.fn(),
		on: jest.fn(),
		destroy: jest.fn(),
	};
	res.status.mockReturnValue(res);
	return res;
}

function createRequest(headers: Record<string, string> = {}) {
	return {
		method: "GET",
		path: "/resources/abc/file.png",
		headers,
	} as unknown as Request;
}

function makeStream() {
	return new Readable({ read() {} });
}

function mockReadStream(stream: Readable) {
	createReadStreamMock.mockReturnValue(
		stream as unknown as ReturnType<typeof createReadStream>,
	);
}

function formatterMock() {
	return jest.fn<
		ReturnType<BufferAttributeFormatter>,
		Parameters<BufferAttributeFormatter>
	>();
}

function formattedEtag(
	params: Record<string, string>,
	plugin = "plugin",
	version = "1.0.0",
	sourceId = "source",
	entity = "track",
	key = "front",
	file = "file.png",
) {
	const sorted = Object.keys(params)
		.sort()
		.map((paramKey) => `${paramKey}=${params[paramKey]}`)
		.join("&");

	return `"${createHash("sha1")
		.update(
			`${plugin}@${version}:${sourceId}:${entity}:${key}:${file}?${sorted}`,
		)
		.digest("hex")}"`;
}

function createSource(name = "plugin", version = "1.0.0", id = "source") {
	return {
		plugin: { package: { name, version } },
		source: { id },
	};
}

describe("ResourcesController", () => {
	let controller: ResourcesController;
	let resourceManager: { resolveResourcePath: jest.Mock };
	let attributeSources: {
		getAttributeSource: jest.Mock;
		getBufferAttributeFormatter: jest.Mock;
	};

	beforeEach(() => {
		createReadStreamMock.mockReset();
		statMock.mockReset();
		getTypeMock.mockReset();

		statMock.mockResolvedValue({} as Awaited<ReturnType<typeof stat>>);
		getTypeMock.mockReturnValue(null);

		resourceManager = { resolveResourcePath: jest.fn() };
		attributeSources = {
			getAttributeSource: jest.fn(),
			getBufferAttributeFormatter: jest.fn(),
		};

		controller = new ResourcesController(
			resourceManager as unknown as ResourceManagerService,
			attributeSources as unknown as AttributeSourcesService,
		);
	});

	it("throws NotFound for an invalid path", async () => {
		resourceManager.resolveResourcePath.mockReturnValue(null);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"ab",
				"file.png",
				{},
			),
		).rejects.toThrow(NotFoundException);
		expect(statMock).not.toHaveBeenCalled();
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
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
			),
		).rejects.toThrow(NotFoundException);
		expect(createReadStreamMock).not.toHaveBeenCalled();
	});

	it("streams the original with cache headers", async () => {
		const stream = makeStream();
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		mockReadStream(stream);
		getTypeMock.mockReturnValue("image/png");
		const res = createResponse();

		const result = await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.png",
			{},
		);

		expect(createReadStreamMock).toHaveBeenCalledWith("/tmp/file.png");
		expect(res.set).toHaveBeenCalledWith({
			"Content-Type": "image/png",
			"Cache-Control": RAW_CACHE_CONTROL,
			ETag: '"file.png"',
		});
		expect(result).toBeInstanceOf(StreamableFile);
		expect((result as StreamableFile).getStream()).toBe(stream);
	});

	it("falls back to octet-stream for unknown mime types", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.zzzq",
			uuid: UUID,
			extension: "zzzq",
		});
		mockReadStream(makeStream());
		getTypeMock.mockReturnValue(null);
		const res = createResponse();

		await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.zzzq",
			{},
		);

		expect(res.set).toHaveBeenCalledWith(
			expect.objectContaining({ "Content-Type": "application/octet-stream" }),
		);
	});

	it("returns 304 for raw resources when the etag matches", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		const res = createResponse();

		const result = await controller.get(
			createRequest({ "if-none-match": '"file.png"' }),
			res as unknown as Response,
			"abc",
			"file.png",
			{},
		);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.end).not.toHaveBeenCalled();
		expect(createReadStreamMock).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it("rejects partially supplied formatter control params", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
			),
		).rejects.toThrow(BadRequestException);
	});

	it("rejects invalid entity types", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
				"source",
				"bogus",
				"front",
			),
		).rejects.toThrow(BadRequestException);
	});

	it("throws NotFound when the attribute source is not registered", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(null);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
				"source",
				"track",
				"front",
			),
		).rejects.toThrow(NotFoundException);
	});

	it("throws NotFound when no buffer formatter is registered", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(null);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
				"source",
				"track",
				"front",
			),
		).rejects.toThrow(NotFoundException);
	});

	it("serves the stream produced by a buffer attribute formatter", async () => {
		const sourceStream = makeStream();
		const formattedStream = makeStream();
		const formatter = formatterMock().mockResolvedValue({
			stream: formattedStream,
			contentType: "image/webp",
		});

		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		mockReadStream(sourceStream);
		const res = createResponse();

		const result = await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.png",
			{ width: "100" },
			"plugin",
			"source",
			"track",
			"front",
		);

		const info = formatter.mock.calls[0][0];
		expect(info.uuid).toBe(UUID);
		expect(info.extension).toBe("png");
		expect(info.params).toEqual({ width: "100" });
		expect(typeof info.getStream).toBe("function");

		expect(res.set).toHaveBeenCalledWith({
			"Content-Type": "image/webp",
			"Cache-Control": FORMATTED_CACHE_CONTROL,
			ETag: formattedEtag({ width: "100" }),
		});
		expect((result as StreamableFile).getStream()).toBe(formattedStream);
	});

	it("derives the formatted content type from the result extension", async () => {
		const formatter = formatterMock().mockResolvedValue({
			stream: makeStream(),
			extension: "webp",
		});

		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		getTypeMock.mockReturnValue("image/webp");
		const res = createResponse();

		await controller.get(
			createRequest(),
			res as unknown as Response,
			"abc",
			"file.png",
			{},
			"plugin",
			"source",
			"track",
			"front",
		);

		expect(getTypeMock).toHaveBeenCalledWith("webp");
		expect(res.set).toHaveBeenCalledWith(
			expect.objectContaining({ "Content-Type": "image/webp" }),
		);
	});

	it("destroys formatter streams when the formatter declines", async () => {
		const tracked = makeStream();
		const destroySpy = jest.spyOn(tracked, "destroy");
		const formatter = formatterMock().mockImplementation((info) => {
			info.getStream();
			return Promise.resolve(null);
		});

		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		mockReadStream(tracked);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
				"source",
				"track",
				"front",
			),
		).rejects.toThrow(BadRequestException);

		expect(destroySpy).toHaveBeenCalled();
	});

	it("maps formatter failures to a 500", async () => {
		const formatter = formatterMock().mockRejectedValue(new Error("boom"));

		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);

		await expect(
			controller.get(
				createRequest(),
				createResponse() as unknown as Response,
				"abc",
				"file.png",
				{},
				"plugin",
				"source",
				"track",
				"front",
			),
		).rejects.toThrow(InternalServerErrorException);
	});

	it("returns 304 for formatted resources when the etag matches", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		const formatter = formatterMock();
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		const res = createResponse();

		const result = await controller.get(
			createRequest({ "if-none-match": formattedEtag({ width: "100" }) }),
			res as unknown as Response,
			"abc",
			"file.png",
			{ width: "100" },
			"plugin",
			"source",
			"track",
			"front",
		);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.end).not.toHaveBeenCalled();
		expect(formatter).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it("produces different formatted etags for different params", async () => {
		resourceManager.resolveResourcePath.mockReturnValue({
			path: "/tmp/file.png",
			uuid: UUID,
			extension: "png",
		});
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(
			formatterMock().mockResolvedValue({
				stream: makeStream(),
				contentType: "image/webp",
			}),
		);

		const etag100 = formattedEtag({ width: "100" });
		const etag200 = formattedEtag({ width: "200" });
		expect(etag100).not.toBe(etag200);

		const firstRes = createResponse();
		await controller.get(
			createRequest(),
			firstRes as unknown as Response,
			"abc",
			"file.png",
			{ width: "100" },
			"plugin",
			"source",
			"track",
			"front",
		);

		const secondRes = createResponse();
		await controller.get(
			createRequest(),
			secondRes as unknown as Response,
			"abc",
			"file.png",
			{ width: "200" },
			"plugin",
			"source",
			"track",
			"front",
		);

		expect(firstRes.set).toHaveBeenCalledWith(
			expect.objectContaining({ ETag: etag100 }),
		);
		expect(secondRes.set).toHaveBeenCalledWith(
			expect.objectContaining({ ETag: etag200 }),
		);
	});
});
