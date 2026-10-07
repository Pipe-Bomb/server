import { EphemeralService } from "./ephemeral.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { LoadedAttribute } from "src/attributes/interface/loaded-attribute.interface";
import { RelativeUrl } from "src/interception/relative-url";

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

			const formatted = result.thumb.formatted![0] as RelativeUrl;
			expect(formatted.url).toMatch(
				/^\/ephemeral\/attribute-buffer\/[0-9a-f-]+\.webp\?plugin=a&source=src-a&entity=track&key=thumb$/,
			);
		} finally {
			jest.useRealTimers();
		}
	});
});
