import { EphemeralService } from "./ephemeral.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { LoadedAttribute } from "src/attributes/interface/loaded-attribute.interface";
import { ResourceResponse } from "src/resource-manager/response/resource.response";
import { ArtistIdentityTarget } from "src/artist-manager/enum/artist-identity-target.enum";

function makeSource(name: string, id: string): LoadedAttributeSource {
	return {
		plugin: { package: { name, version: "1.0.0" } },
		source: { id, getName: () => id },
	} as unknown as LoadedAttributeSource;
}

describe("EphemeralService.createEphemeralAttributes", () => {
	let service: EphemeralService;
	let attributeSourcesService: AttributeSourcesService;

	beforeEach(() => {
		attributeSourcesService = new AttributeSourcesService(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
		);
		service = new EphemeralService(
			attributeSourcesService,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
		);
	});

	it("attributes values to the ephemeral attribute source and the formatter to the definition source", () => {
		const a = makeSource("a", "src-a");
		const b = makeSource("b", "src-b");
		(
			attributeSourcesService as unknown as {
				sources: LoadedAttributeSource[];
			}
		).sources.push(a, b);

		attributeSourcesService.registerTrackAttribute(a, {
			key: "title",
			type: "string",
			supportsMultiple: true,
			formatter: (value) => value.toUpperCase(),
		});
		attributeSourcesService.registerTrackAttribute(b, {
			key: "title",
			type: "string",
			supportsMultiple: true,
		});

		const possibleAttributes: LoadedAttribute[] = [
			{
				attribute: {
					key: "title",
					type: "string",
					supportsMultiple: true,
				},
				source: b,
			},
		];

		const result = service.createEphemeralAttributes(
			[{ key: "title", value: "hello" }],
			b,
			possibleAttributes,
			"track",
		);

		expect(result.title.pluginId).toBe("b");
		expect(result.title.sourceId).toBe("src-b");
		expect(result.title.formatterPluginId).toBe("a");
		expect(result.title.formatterSourceId).toBe("src-a");
		expect(result.title.values).toEqual(["hello"]);
		expect(result.title.formatted).toEqual(["HELLO"]);
	});

	it("emits a formatter URL for buffer attributes with a formatter", () => {
		jest.useFakeTimers();

		try {
			const a = makeSource("a", "src-a");
			const b = makeSource("b", "src-b");
			(
				attributeSourcesService as unknown as {
					sources: LoadedAttributeSource[];
				}
			).sources.push(a, b);

			attributeSourcesService.registerTrackAttribute(a, {
				key: "thumb",
				type: "buffer",
				supportsMultiple: false,
				formatter: () => Promise.resolve(null),
			});
			attributeSourcesService.registerTrackAttribute(b, {
				key: "thumb",
				type: "buffer",
				supportsMultiple: false,
			});

			const possibleAttributes: LoadedAttribute[] = [
				{
					attribute: {
						key: "thumb",
						type: "buffer",
						supportsMultiple: false,
					},
					source: b,
				},
			];

			const result = service.createEphemeralAttributes(
				[
					{
						key: "thumb",
						value: { extension: "webp", buffer: Buffer.from("x") },
					},
				],
				b,
				possibleAttributes,
				"track",
			);

			expect(result.thumb.pluginId).toBe("b");
			expect(result.thumb.sourceId).toBe("src-b");
			expect(result.thumb.formatterPluginId).toBe("a");
			expect(result.thumb.formatterSourceId).toBe("src-a");
			expect(result.thumb.formatted).toHaveLength(1);

			const formatted = result.thumb.formatted[0] as ResourceResponse;
			expect(formatted.extension).toBe("webp");
			expect(formatted.sha256).toBeNull();
			expect(formatted.uuid).toMatch(/^[0-9a-f-]+$/);
			expect(formatted.url.url).toMatch(
				/^\/ephemeral\/attribute-buffer\/[0-9a-f-]+\.webp\?plugin=a&source=src-a&entity=track&key=thumb$/,
			);
		} finally {
			jest.useRealTimers();
		}
	});

	it("mirrors the raw resource for buffer attributes without a formatter", () => {
		jest.useFakeTimers();

		try {
			const b = makeSource("b", "src-b");
			(
				attributeSourcesService as unknown as {
					sources: LoadedAttributeSource[];
				}
			).sources.push(b);

			attributeSourcesService.registerTrackAttribute(b, {
				key: "thumb",
				type: "buffer",
				supportsMultiple: false,
			});

			const possibleAttributes: LoadedAttribute[] = [
				{
					attribute: {
						key: "thumb",
						type: "buffer",
						supportsMultiple: false,
					},
					source: b,
				},
			];

			const result = service.createEphemeralAttributes(
				[
					{
						key: "thumb",
						value: { extension: "webp", buffer: Buffer.from("x") },
					},
				],
				b,
				possibleAttributes,
				"track",
			);

			expect(result.thumb.formatterPluginId).toBeNull();
			expect(result.thumb.formatterSourceId).toBeNull();
			expect(result.thumb.formatted).toHaveLength(1);
			expect(result.thumb.formatted[0]).toEqual(result.thumb.values[0]);

			const formatted = result.thumb.formatted[0] as ResourceResponse;
			expect(formatted.url.url).toMatch(
				/^\/ephemeral\/attribute-buffer\/[0-9a-f-]+\.webp$/,
			);
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("EphemeralService.createAlbumArtistsAndAttributes", () => {
	let service: EphemeralService;
	let attributeSourcesService: {
		getAlbumAttributeRows: jest.Mock;
		createAlbumAttributes: jest.Mock;
		replaceAllAlbumAttributes: jest.Mock;
		createArtistAttributes: jest.Mock;
		upsertArtistAttributes: jest.Mock;
	};
	let artistManagerService: { resolveArtist: jest.Mock };
	let albumManagerService: {
		findOne: jest.Mock;
		setArtistLinks: jest.Mock;
		setJoinPhrase: jest.Mock;
	};
	let emitter: { emit: jest.Mock };
	let attributeSource: LoadedAttributeSource;
	let albumSource: {
		source: { id: string; resolveAlbum: jest.Mock };
		plugin: { package: { name: string } };
	};

	beforeEach(() => {
		attributeSourcesService = {
			getAlbumAttributeRows: jest.fn(),
			createAlbumAttributes: jest.fn(),
			replaceAllAlbumAttributes: jest.fn(),
			createArtistAttributes: jest.fn(),
			upsertArtistAttributes: jest.fn(),
		};
		artistManagerService = {
			resolveArtist: jest.fn().mockResolvedValue("artist-uuid"),
		};
		albumManagerService = {
			findOne: jest.fn().mockResolvedValue({ uuid: "album-1" }),
			setArtistLinks: jest.fn().mockResolvedValue(undefined),
			setJoinPhrase: jest.fn().mockResolvedValue(undefined),
		};
		emitter = { emit: jest.fn() };
		attributeSource = makeSource("plug", "src-a");

		service = new EphemeralService(
			attributeSourcesService as unknown as AttributeSourcesService,
			artistManagerService as any,
			albumManagerService as any,
			{} as any,
			{} as any,
			emitter as any,
		);

		albumSource = {
			source: {
				id: "src-a",
				resolveAlbum: jest.fn().mockResolvedValue({
					attributes: [{ key: "title", value: "Hello" }],
					artists: [
						{
							pluginId: "plug",
							identityId: "artist-id",
							identity: "artist-1",
							joinPhrase: " & ",
							attributes: [{ key: "name", value: "Artist" }],
						},
					],
				}),
			},
			plugin: { package: { name: "plug" } },
		};
		(
			service as unknown as { albumIdentifiers: Map<string, unknown> }
		).albumIdentifiers.set("plug:id1", albumSource);
		(
			service as unknown as {
				attributeSources: Map<unknown, LoadedAttributeSource>;
			}
		).attributeSources.set(albumSource.source, attributeSource);
	});

	it("creates and links album artists, then attributes the album and artists", async () => {
		attributeSourcesService.getAlbumAttributeRows
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ key: "title" }]);
		attributeSourcesService.createAlbumAttributes.mockResolvedValue([
			{ key: "title" },
		]);
		attributeSourcesService.createArtistAttributes.mockResolvedValue([
			{ key: "name" },
		]);

		const result = await service.createAlbumArtistsAndAttributes(
			"plug",
			"id1",
			"album-id",
			"album-1",
		);

		expect(result).toBe(true);
		expect(artistManagerService.resolveArtist).toHaveBeenCalledWith(
			"plug",
			"artist-id",
			"artist-1",
			ArtistIdentityTarget.ALBUM,
			true,
		);
		expect(albumManagerService.setArtistLinks).toHaveBeenCalledWith(
			{ uuid: "album-1" },
			["artist-uuid"],
			"plug",
			"id1",
		);
		expect(albumManagerService.setJoinPhrase).toHaveBeenCalledWith(
			{ uuid: "album-1" },
			"artist-uuid",
			" & ",
		);
		expect(attributeSourcesService.createAlbumAttributes).toHaveBeenCalledWith(
			"album-1",
			[{ key: "title", value: "Hello" }],
			attributeSource,
		);
		expect(
			attributeSourcesService.replaceAllAlbumAttributes,
		).toHaveBeenCalledWith("album-1", [{ key: "title" }]);
		expect(attributeSourcesService.createArtistAttributes).toHaveBeenCalledWith(
			"artist-uuid",
			[{ key: "name", value: "Artist" }],
			attributeSource,
		);
		expect(attributeSourcesService.upsertArtistAttributes).toHaveBeenCalledWith(
			[{ key: "name" }],
		);
		expect(emitter.emit).toHaveBeenCalledWith("album.attributes.updated", {
			uuid: "album-1",
		});
	});

	it("returns false when the source cannot resolve the album", async () => {
		albumSource.source.resolveAlbum.mockResolvedValue(null);

		const result = await service.createAlbumArtistsAndAttributes(
			"plug",
			"id1",
			"album-id",
			"album-1",
		);

		expect(result).toBe(false);
		expect(artistManagerService.resolveArtist).not.toHaveBeenCalled();
		expect(
			attributeSourcesService.createAlbumAttributes,
		).not.toHaveBeenCalled();
	});
});
