import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ResourcesService } from "./resources.service";
import { DBResource } from "./entities/resource.entity";

jest.mock("sharp", () => {
	const sharp = jest.fn();
	sharp.mockReturnValue({
		resize: jest.fn().mockReturnThis(),
		webp: jest.fn().mockReturnThis(),
		toBuffer: jest.fn().mockResolvedValue(Buffer.from("webp")),
	});
	return sharp;
});

describe("ResourcesService", () => {
	let service: ResourcesService;
	let repo: any;

	beforeEach(async () => {
		repo = {
			findOneBy: jest.fn(),
			create: jest.fn(),
			insert: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ResourcesService,
				{
					provide: getRepositoryToken(DBResource),
					useValue: repo,
				},
			],
		}).compile();

		service = module.get(ResourcesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("isValidExtension", () => {
		it("accepts valid extensions", () => {
			expect(service.isValidExtension("png")).toBe(true);
			expect(service.isValidExtension("image.jpg")).toBe(true);
			expect(service.isValidExtension("a.b-c_1")).toBe(true);
		});

		it("rejects empty string", () => {
			expect(service.isValidExtension("")).toBe(false);
		});

		it("rejects too long", () => {
			expect(service.isValidExtension("a".repeat(33))).toBe(false);
		});

		it("rejects invalid characters", () => {
			expect(service.isValidExtension("a b")).toBe(false);
			expect(service.isValidExtension("-start")).toBe(false);
		});
	});

	describe("create", () => {
		it("returns existing resource for duplicate sha256", async () => {
			const existing = { uuid: "existing", sha256: "abc" };
			repo.findOneBy.mockResolvedValue(existing);

			const result = await service.create(
				Buffer.from("data"),
				"png",
			);
			expect(result).toBe(existing);
		});

		it("throws on invalid extension", async () => {
			await expect(
				service.create(Buffer.from("data"), ""),
			).rejects.toThrow("Extension is invalid");
		});
	});

	describe("sanitizeDimension", () => {
		it("returns null for undefined/null", () => {
			expect(service.sanitizeDimension(undefined)).toBeNull();
			expect(service.sanitizeDimension(null)).toBeNull();
		});

		it("parses valid numbers", () => {
			expect(service.sanitizeDimension(100)).toBe(100);
			expect(service.sanitizeDimension("200")).toBe(200);
		});

		it("accepts array input (takes first)", () => {
			expect(service.sanitizeDimension([50, 100])).toBe(50);
		});

		it("returns null for non-numeric strings", () => {
			expect(service.sanitizeDimension("abc")).toBeNull();
		});

		it("returns null for values exceeding max", () => {
			expect(service.sanitizeDimension(5000)).toBeNull();
		});

		it("returns null for zero or negative", () => {
			expect(service.sanitizeDimension(0)).toBeNull();
			expect(service.sanitizeDimension(-1)).toBeNull();
		});
	});

	describe("resizeImage", () => {
		it("returns original buffer when no dimensions", async () => {
			const buf = Buffer.from("img");
			await expect(
				service.resizeImage(buf, { width: null, height: null }),
			).resolves.toBe(buf);
		});
	});
});
