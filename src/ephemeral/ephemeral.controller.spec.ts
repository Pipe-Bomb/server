import { NotFoundException } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { EphemeralController } from "./ephemeral.controller";
import { EphemeralService } from "./ephemeral.service";

jest.mock("mime", () => ({
	__esModule: true,
	default: {
		getType: jest.fn(),
	},
}));
import type { BufferAttributeStreamService } from "src/attribute-sources/buffer-attribute-stream.service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

function createRequest() {
	return {
		method: "GET",
		path: "/ephemeral/attribute-buffer/file.png",
		headers: {},
	} as unknown as Request;
}

function createResponse() {
	return {} as unknown as Response;
}

async function readStream(stream: Readable) {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString();
}

describe("EphemeralController", () => {
	let controller: EphemeralController;
	let ephemeralService: { getProxiedAttribute: jest.Mock };
	let bufferAttributeStream: {
		serve: jest.MockedFunction<BufferAttributeStreamService["serve"]>;
	};

	beforeEach(() => {
		ephemeralService = { getProxiedAttribute: jest.fn() };
		bufferAttributeStream = {
			serve: jest.fn() as unknown as jest.MockedFunction<
				BufferAttributeStreamService["serve"]
			>,
		};

		controller = new EphemeralController(
			ephemeralService as unknown as EphemeralService,
			bufferAttributeStream as unknown as BufferAttributeStreamService,
		);
	});

	it("throws NotFound for a malformed file name", async () => {
		await expect(
			controller.getAttributeBuffer(
				createRequest(),
				createResponse(),
				"file",
				{},
			),
		).rejects.toThrow(NotFoundException);
		expect(bufferAttributeStream.serve).not.toHaveBeenCalled();
	});

	it("throws NotFound when the proxied attribute is missing", async () => {
		ephemeralService.getProxiedAttribute.mockReturnValue(null);

		await expect(
			controller.getAttributeBuffer(
				createRequest(),
				createResponse(),
				`${UUID}.png`,
				{},
			),
		).rejects.toThrow(NotFoundException);
		expect(bufferAttributeStream.serve).not.toHaveBeenCalled();
	});

	it("delegates an in-memory buffer to the stream service", async () => {
		ephemeralService.getProxiedAttribute.mockReturnValue({
			extension: "png",
			buffer: Buffer.from("hello"),
		});
		bufferAttributeStream.serve.mockResolvedValue(undefined);
		const req = createRequest();
		const res = createResponse();

		await controller.getAttributeBuffer(req, res, `${UUID}.png`, {});

		expect(ephemeralService.getProxiedAttribute).toHaveBeenCalledWith(UUID);
		expect(bufferAttributeStream.serve).toHaveBeenCalledWith(
			req,
			res,
			{ uuid: UUID, extension: "png", file: `${UUID}.png` },
			expect.any(Function),
			{},
			{
				pluginId: undefined,
				sourceId: undefined,
				entity: undefined,
				key: undefined,
			},
		);

		const getStream = bufferAttributeStream.serve.mock.calls[0][3];
		expect(await readStream(getStream())).toBe("hello");
	});

	it("awaits lazily-produced buffers", async () => {
		ephemeralService.getProxiedAttribute.mockReturnValue({
			extension: "png",
			buffer: () => Promise.resolve(Buffer.from("world")),
		});
		bufferAttributeStream.serve.mockResolvedValue(undefined);

		await controller.getAttributeBuffer(
			createRequest(),
			createResponse(),
			`${UUID}.png`,
			{},
		);

		const getStream = bufferAttributeStream.serve.mock.calls[0][3];
		expect(await readStream(getStream())).toBe("world");
	});

	it("forwards formatter control params to the service", async () => {
		ephemeralService.getProxiedAttribute.mockReturnValue({
			extension: "png",
			buffer: Buffer.from("hello"),
		});
		bufferAttributeStream.serve.mockResolvedValue(undefined);

		await controller.getAttributeBuffer(
			createRequest(),
			createResponse(),
			`${UUID}.png`,
			{ width: "100" },
			"plugin",
			"source",
			"track",
			"front",
		);

		expect(bufferAttributeStream.serve).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			{ uuid: UUID, extension: "png", file: `${UUID}.png` },
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
