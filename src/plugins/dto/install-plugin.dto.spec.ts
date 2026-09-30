import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InstallPluginDto } from "./install-plugin.dto";

describe("InstallPluginDto", () => {
	it("accepts a valid url without a ref", async () => {
		const dto = plainToInstance(InstallPluginDto, {
			url: "https://git.example.com/repo.git",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("accepts a valid url with a ref", async () => {
		const dto = plainToInstance(InstallPluginDto, {
			url: "https://git.example.com/repo.git",
			ref: "v1.0.0",
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it("rejects a missing url", async () => {
		const dto = plainToInstance(InstallPluginDto, {});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("url");
	});

	it("rejects an empty url", async () => {
		const dto = plainToInstance(InstallPluginDto, { url: "" });

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toContain("url");
	});
});
