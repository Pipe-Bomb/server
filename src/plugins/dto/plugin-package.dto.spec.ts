import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PluginPackageDto } from "./plugin-package.dto";

describe("PluginPackageDto", () => {
	it("accepts a minimal valid package", async () => {
		const dto = plainToInstance(PluginPackageDto, {
			name: "fake-pkg",
			version: "1.2.3",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("accepts the optional pipebombEntry, main and description fields", async () => {
		const dto = plainToInstance(PluginPackageDto, {
			name: "fake-pkg",
			version: "1.0.0",
			pipebombEntry: "dist/plugin.js",
			main: "index.js",
			description: "A plugin",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("rejects a missing name", async () => {
		const dto = plainToInstance(PluginPackageDto, { version: "1.0.0" });

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("name");
	});

	it("rejects an empty name", async () => {
		const dto = plainToInstance(PluginPackageDto, {
			name: "",
			version: "1.0.0",
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("name");
	});

	it("rejects a missing version", async () => {
		const dto = plainToInstance(PluginPackageDto, { name: "fake-pkg" });

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("version");
	});

	it("rejects a version that is not semver", async () => {
		const dto = plainToInstance(PluginPackageDto, {
			name: "fake-pkg",
			version: "banana",
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("version");
	});

	it("rejects a non-string pipebombEntry", async () => {
		const dto = plainToInstance(PluginPackageDto, {
			name: "fake-pkg",
			version: "1.0.0",
			pipebombEntry: 42,
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("pipebombEntry");
	});
});
