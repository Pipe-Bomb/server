import { CallHandler, ExecutionContext, StreamableFile } from "@nestjs/common";
import { Observable, firstValueFrom, of } from "rxjs";
import { AttributeInterceptor } from "./attribute.interceptor";
import { AttributeSourcesService } from "./attribute-sources.service";
import { RelativeUrl } from "src/interception/relative-url";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";

const attributeSourcesService = {
	toMap: jest.fn(),
};

function makeRequest(
	headers: Record<string, string> = { host: "example.com" },
): unknown {
	return {
		get: jest.fn((name: string) => headers[name]),
		protocol: "http",
		method: "GET",
		path: "/tracks/1",
	};
}

function mockContext(request: unknown): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => () => {},
		getClass: () => class {},
	} as unknown as ExecutionContext;
}

function makeEntityAttribute(entity: new () => object, key: string): object {
	const attribute = new entity() as DBTrackAttribute;
	attribute.key = key;
	attribute.pluginId = "plugin-a";
	attribute.sourceId = "source-1";
	attribute.value_string = "value";
	return attribute;
}

describe("AttributeInterceptor", () => {
	let interceptor: AttributeInterceptor;
	let originalBasePath: string | undefined;

	beforeEach(() => {
		jest.clearAllMocks();
		interceptor = new AttributeInterceptor(
			attributeSourcesService as unknown as AttributeSourcesService,
		);
		originalBasePath = process.env.BASE_PATH;
		delete process.env.BASE_PATH;
	});

	afterEach(() => {
		if (originalBasePath === undefined) {
			delete process.env.BASE_PATH;
		} else {
			process.env.BASE_PATH = originalBasePath;
		}
	});

	async function run(
		data: unknown,
		request: unknown = makeRequest(),
	): Promise<unknown> {
		const next = {
			handle: () => of(data),
		} as unknown as CallHandler;
		const observable = interceptor.intercept(mockContext(request), next);

		return firstValueFrom(observable as Observable<unknown>);
	}

	it("rewrites RelativeUrl values against the request base url", async () => {
		const result = await run({ url: new RelativeUrl("/files/1.mp3") });

		expect(result).toEqual({ url: "http://example.com/files/1.mp3" });
	});

	it("maps track attributes through toMap with type 'track'", async () => {
		const attributes = [makeEntityAttribute(DBTrackAttribute, "title")];
		attributeSourcesService.toMap.mockReturnValue({ title: "mapped" });

		const result = (await run({ attributes })) as { attributes: unknown };

		expect(attributeSourcesService.toMap).toHaveBeenCalledWith(
			attributes,
			"track",
		);
		expect(result.attributes).toEqual({ title: "mapped" });
	});

	it("detects the 'artist' type from the first attribute", async () => {
		attributeSourcesService.toMap.mockReturnValue({});

		await run({
			attributes: [makeEntityAttribute(DBArtistAttribute, "title")],
		});

		expect(attributeSourcesService.toMap).toHaveBeenCalledWith(
			expect.any(Array),
			"artist",
		);
	});

	it("detects the 'album' type from the first attribute", async () => {
		attributeSourcesService.toMap.mockReturnValue({});

		await run({
			attributes: [makeEntityAttribute(DBAlbumAttribute, "title")],
		});

		expect(attributeSourcesService.toMap).toHaveBeenCalledWith(
			expect.any(Array),
			"album",
		);
	});

	it("detects the 'playlist' type from the first attribute", async () => {
		attributeSourcesService.toMap.mockReturnValue({});

		await run({
			attributes: [makeEntityAttribute(DBPlaylistAttribute, "title")],
		});

		expect(attributeSourcesService.toMap).toHaveBeenCalledWith(
			expect.any(Array),
			"playlist",
		);
	});

	it("passes an empty attributes array to toMap with a null type", async () => {
		attributeSourcesService.toMap.mockReturnValue({});

		await run({ attributes: [] });

		expect(attributeSourcesService.toMap).toHaveBeenCalledWith([], null);
	});

	it("leaves attributes arrays containing non-entity items untouched", async () => {
		const attributes = [
			{ key: "plain" },
			makeEntityAttribute(DBTrackAttribute, "title"),
		];
		const data = { attributes };

		const result = (await run(data)) as { attributes: unknown };

		expect(attributeSourcesService.toMap).not.toHaveBeenCalled();
		expect(result.attributes).toEqual(attributes);
	});

	it("passes null, undefined, numbers, strings and StreamableFile through unchanged", async () => {
		const file = new StreamableFile(Buffer.from("data"));
		const result = (await run({
			nothing: null,
			absent: undefined,
			file,
			count: 5,
			text: "hello",
		})) as Record<string, unknown>;

		expect(result["nothing"]).toBeNull();
		expect(result["absent"]).toBeUndefined();
		expect(result.file).toBe(file);
		expect(result.count).toBe(5);
		expect(result.text).toBe("hello");
	});

	it("traverses nested arrays and objects", async () => {
		const result = (await run({
			list: [{ deep: new RelativeUrl("/a") }, 2],
		})) as { list: [Record<string, string>, number] };

		expect(result.list[0].deep).toBe("http://example.com/a");
		expect(result.list[1]).toBe(2);
	});

	it("rethrows and logs when the base url cannot be resolved", async () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {});
		const request = makeRequest({});

		await expect(run({ ok: true }, request)).rejects.toThrow(
			"Host not specified",
		);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
