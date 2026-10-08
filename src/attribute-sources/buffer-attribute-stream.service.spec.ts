import {
	BadRequestException,
	InternalServerErrorException,
	NotFoundException,
	StreamableFile,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { createHash } from "crypto";
import mime from "mime";
import type { BufferAttributeFormatter } from "@sdk";
import { BufferAttributeStreamService } from "./buffer-attribute-stream.service";
import { AttributeSourcesService } from "./attribute-sources.service";

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
	},
}));

const getTypeMock = (mime as unknown as { getType: jest.Mock }).getType;

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const TARGET = { uuid: UUID, extension: "png", file: "file.png" };

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

function formatterMock() {
	return jest.fn<
		ReturnType<BufferAttributeFormatter>,
		Parameters<BufferAttributeFormatter>
	>();
}

function createSource(name = "plugin", version = "1.0.0", id = "source") {
	return {
		plugin: { package: { name, version } },
		source: { id },
	};
}

type ControlArgs = {
	pluginId?: string;
	sourceId?: string;
	entity?: string;
	key?: string;
};

const CONTROL: ControlArgs = {
	pluginId: "plugin",
	sourceId: "source",
	entity: "track",
	key: "front",
};

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

describe("BufferAttributeStreamService", () => {
	let service: BufferAttributeStreamService;
	let attributeSources: {
		getAttributeSource: jest.Mock;
		getBufferAttributeFormatter: jest.Mock;
	};

	beforeEach(() => {
		getTypeMock.mockReset();
		getTypeMock.mockReturnValue(null);

		attributeSources = {
			getAttributeSource: jest.fn(),
			getBufferAttributeFormatter: jest.fn(),
		};

		service = new BufferAttributeStreamService(
			attributeSources as unknown as AttributeSourcesService,
		);
	});

	it("streams the raw buffer with cache headers", async () => {
		const stream = makeStream();
		getTypeMock.mockReturnValue("image/png");
		const res = createResponse();

		const result = await service.serve(
			createRequest(),
			res as unknown as Response,
			TARGET,
			() => stream,
			{},
			{},
		);

		expect(res.set).toHaveBeenCalledWith({
			"Content-Type": "image/png",
			"Cache-Control": RAW_CACHE_CONTROL,
			ETag: '"file.png"',
		});
		expect(result).toBeInstanceOf(StreamableFile);
		expect((result as StreamableFile).getStream()).toBe(stream);
	});

	it("falls back to octet-stream for unknown mime types", async () => {
		const res = createResponse();

		await service.serve(
			createRequest(),
			res as unknown as Response,
			TARGET,
			() => makeStream(),
			{},
			{},
		);

		expect(res.set).toHaveBeenCalledWith(
			expect.objectContaining({ "Content-Type": "application/octet-stream" }),
		);
	});

	it("returns 304 for raw buffers when the etag matches", async () => {
		const getStream = jest.fn();
		const res = createResponse();

		const result = await service.serve(
			createRequest({ "if-none-match": '"file.png"' }),
			res as unknown as Response,
			TARGET,
			getStream,
			{},
			{},
		);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.end).not.toHaveBeenCalled();
		expect(getStream).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it("rejects partially supplied control params", async () => {
		const getStream = jest.fn();

		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				getStream,
				{},
				{ pluginId: "plugin" },
			),
		).rejects.toThrow(BadRequestException);
		expect(getStream).not.toHaveBeenCalled();
	});

	it("rejects invalid entity types", async () => {
		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				() => makeStream(),
				{},
				{ ...CONTROL, entity: "bogus" },
			),
		).rejects.toThrow(BadRequestException);
	});

	it("throws NotFound when the attribute source is not registered", async () => {
		attributeSources.getAttributeSource.mockReturnValue(null);

		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				() => makeStream(),
				{},
				CONTROL,
			),
		).rejects.toThrow(NotFoundException);
	});

	it("throws NotFound when no buffer formatter is registered", async () => {
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(null);

		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				() => makeStream(),
				{},
				CONTROL,
			),
		).rejects.toThrow(NotFoundException);
	});

	it("serves the stream produced by a buffer attribute formatter", async () => {
		const formattedStream = makeStream();
		const formatter = formatterMock().mockResolvedValue({
			stream: formattedStream,
			contentType: "image/webp",
		});

		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		const res = createResponse();

		const result = await service.serve(
			createRequest(),
			res as unknown as Response,
			TARGET,
			() => makeStream(),
			{ width: "100" },
			CONTROL,
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

		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		getTypeMock.mockReturnValue("image/webp");
		const res = createResponse();

		await service.serve(
			createRequest(),
			res as unknown as Response,
			TARGET,
			() => makeStream(),
			{},
			CONTROL,
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

		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);

		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				() => tracked,
				{},
				CONTROL,
			),
		).rejects.toThrow(BadRequestException);

		expect(destroySpy).toHaveBeenCalled();
	});

	it("maps formatter failures to a 500", async () => {
		const formatter = formatterMock().mockRejectedValue(new Error("boom"));

		attributeSources.getAttributeSource.mockReturnValue(createSource());
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);

		await expect(
			service.serve(
				createRequest(),
				createResponse() as unknown as Response,
				TARGET,
				() => makeStream(),
				{},
				CONTROL,
			),
		).rejects.toThrow(InternalServerErrorException);
	});

	it("returns 304 for formatted buffers when the etag matches", async () => {
		attributeSources.getAttributeSource.mockReturnValue(createSource());
		const formatter = formatterMock();
		attributeSources.getBufferAttributeFormatter.mockReturnValue(formatter);
		const res = createResponse();

		const result = await service.serve(
			createRequest({ "if-none-match": formattedEtag({ width: "100" }) }),
			res as unknown as Response,
			TARGET,
			() => makeStream(),
			{ width: "100" },
			CONTROL,
		);

		expect(res.status).toHaveBeenCalledWith(304);
		expect(res.end).not.toHaveBeenCalled();
		expect(formatter).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	it("produces different formatted etags for different params", async () => {
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
		await service.serve(
			createRequest(),
			firstRes as unknown as Response,
			TARGET,
			() => makeStream(),
			{ width: "100" },
			CONTROL,
		);

		const secondRes = createResponse();
		await service.serve(
			createRequest(),
			secondRes as unknown as Response,
			TARGET,
			() => makeStream(),
			{ width: "200" },
			CONTROL,
		);

		expect(firstRes.set).toHaveBeenCalledWith(
			expect.objectContaining({ ETag: etag100 }),
		);
		expect(secondRes.set).toHaveBeenCalledWith(
			expect.objectContaining({ ETag: etag200 }),
		);
	});
});
