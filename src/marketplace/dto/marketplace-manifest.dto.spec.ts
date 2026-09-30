import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AddMarketplaceDto } from "./add-marketplace.dto";
import { MarketplaceManifestDto } from "./marketplace-manifest.dto";

function validPlugin(overrides: Record<string, unknown> = {}) {
	return {
		id: "plugin-a",
		name: "Plugin A",
		description: "Does things",
		authorName: "Author",
		authorUrl: "https://author.example.com",
		url: "https://plugin.example.com",
		repository: "https://git.example.com/plugin-a.git",
		...overrides,
	};
}

function validManifest(overrides: Record<string, unknown> = {}) {
	return {
		name: "Test Marketplace",
		plugins: [validPlugin()],
		...overrides,
	};
}

describe("MarketplaceManifestDto", () => {
	it("accepts a valid manifest", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, validManifest());

		expect(await validate(dto)).toHaveLength(0);
	});

	it("accepts a manifest whose plugins omit the optional fields", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, {
			name: "Test Marketplace",
			plugins: [
				{
					id: "plugin-a",
					name: "Plugin A",
					authorName: "Author",
					repository: "https://git.example.com/plugin-a.git",
				},
			],
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("rejects a manifest with a missing name", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, {
			plugins: [validPlugin()],
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("name");
	});

	it("rejects a manifest whose plugins field is not an array", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, {
			name: "Test Marketplace",
			plugins: "nope",
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("plugins");
	});

	it("rejects a plugin with a missing id", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _id, ...plugin } = validPlugin();
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [plugin],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("id");
	});

	it("rejects a plugin with a missing name", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { name: _name, ...plugin } = validPlugin();
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [plugin],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("name");
	});

	it("rejects a plugin with a missing authorName", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { authorName: _authorName, ...plugin } = validPlugin();
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [plugin],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("authorName");
	});

	it("rejects a plugin with a missing repository", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { repository: _repository, ...plugin } = validPlugin();
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [plugin],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("repository");
	});

	it("rejects a plugin with an invalid authorUrl", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [validPlugin({ authorUrl: "not a url" })],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("authorUrl");
	});

	it("rejects a plugin with an invalid url", async () => {
		const dto = plainToInstance(MarketplaceManifestDto, {
			...validManifest(),
			plugins: [validPlugin({ url: "not a url" })],
		});

		const errors = await validate(dto);

		expect(
			errors.flatMap((error) =>
				error.children.flatMap((child) =>
					(child.children ?? []).map((gc) => gc.property),
				),
			),
		).toContain("url");
	});
});

describe("AddMarketplaceDto", () => {
	it("accepts a valid url", async () => {
		const dto = plainToInstance(AddMarketplaceDto, {
			url: "https://marketplace.example.com/manifest.json",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("rejects an empty url", async () => {
		const dto = plainToInstance(AddMarketplaceDto, { url: "" });

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("url");
	});

	it("rejects a value that is not a url", async () => {
		const dto = plainToInstance(AddMarketplaceDto, { url: "not a url" });

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("url");
	});
});
