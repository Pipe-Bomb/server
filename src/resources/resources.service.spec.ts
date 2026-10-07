import path from "path";
import { Repository } from "typeorm";
import { ResourcesService } from "./resources.service";
import { DBResource } from "./entities/resource.entity";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("ResourcesService", () => {
	let service: ResourcesService;

	beforeEach(() => {
		service = new ResourcesService({} as unknown as Repository<DBResource>);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("resolveResourcePath", () => {
		it("resolves a valid resource path", () => {
			expect(service.resolveResourcePath("123", `${UUID}.png`)).toBe(
				path.resolve("resources", "123", `${UUID}.png`),
			);
		});

		it("allows multi-dot extensions", () => {
			expect(
				service.resolveResourcePath("abc", `${UUID}.tar.gz`),
			).not.toBeNull();
		});

		it.each(["ab", "../", "xyz", "1234", "", ".%2e"])(
			"rejects invalid directory %p",
			(dir) => {
				expect(service.resolveResourcePath(dir, `${UUID}.png`)).toBeNull();
			},
		);

		it.each([
			"../etc/passwd",
			"..",
			".",
			`${UUID}/../x.png`,
			`${UUID}.png/..`,
			"not-a-uuid.png",
			`${UUID}`,
			`${UUID}.`,
			`${UUID}.png/`,
		])("rejects invalid file %p", (file) => {
			expect(service.resolveResourcePath("abc", file)).toBeNull();
		});
	});
});
