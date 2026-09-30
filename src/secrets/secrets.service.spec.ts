import { LOG_LEVELS, Logger } from "@nestjs/common";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";
import { SecretsService } from "./secrets.service";

describe("SecretsService", () => {
	let service: SecretsService;
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		jest.clearAllMocks();
		Logger.overrideLogger([]);
		originalCwd = process.cwd();
		tempDir = mkdtempSync(path.join(tmpdir(), "secrets-spec-"));
		process.chdir(tempDir);
		service = new SecretsService();
	});

	afterEach(() => {
		Logger.overrideLogger(LOG_LEVELS);
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates the .secrets directory on construction", () => {
		expect(existsSync(path.join(tempDir, ".secrets"))).toBe(true);
	});

	it("generates a secret via the factory and writes it to disk", () => {
		const factory = jest.fn(() => "generated-secret");

		const secret = service.getOrCreate("token", factory);

		expect(secret).toBe("generated-secret");
		expect(factory).toHaveBeenCalledTimes(1);
		expect(readFileSync(".secrets/token", "utf-8")).toBe("generated-secret");
	});

	it("returns the cached value without calling the factory again", () => {
		const factory = jest.fn(() => "generated-secret");

		const first = service.getOrCreate("token", factory);
		const second = service.getOrCreate("token", factory);

		expect(first).toBe("generated-secret");
		expect(second).toBe("generated-secret");
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("reads an existing secret from disk on a fresh instance", () => {
		writeFileSync(".secrets/key", "from-disk");
		const fresh = new SecretsService();
		const factory = jest.fn(() => "fresh");

		const secret = fresh.getOrCreate("key", factory);

		expect(secret).toBe("from-disk");
		expect(factory).not.toHaveBeenCalled();
	});

	it("accepts a plain string as the create value", () => {
		const secret = service.getOrCreate("plain", "static-value");

		expect(secret).toBe("static-value");
		expect(readFileSync(".secrets/plain", "utf-8")).toBe("static-value");
	});

	it("regenerates the secret when the file on disk is empty", () => {
		writeFileSync(".secrets/empty", "");

		const secret = service.getOrCreate("empty", () => "regenerated");

		expect(secret).toBe("regenerated");
		expect(readFileSync(".secrets/empty", "utf-8")).toBe("regenerated");
	});

	it("returns a known secret from get()", () => {
		service.getOrCreate("token", "abc");

		expect(service.get("token")).toBe("abc");
	});

	it("throws for an unknown secret in get()", () => {
		expect(() => service.get("missing")).toThrow('Secret "missing" not found');
	});

	it("writes the secret file in set()", async () => {
		await service.set("written", "new-value");

		expect(readFileSync(".secrets/written", "utf-8")).toBe("new-value");
	});

	it("rejects in set() when the parent directory does not exist", async () => {
		await expect(service.set("nested/missing/file", "v")).rejects.toThrow();
	});

	it("creates a wrapped base64 auth secret of at least 900 raw bytes", () => {
		const secret = service.createAuthSecret();

		expect(secret).toMatch(/^[A-Za-z0-9+/=\n]+$/);
		expect(secret).toContain("\n");
		expect(secret.replace(/\n/g, "").length).toBeGreaterThanOrEqual(1200);
		expect(secret.length).toBeGreaterThan(1200);
	});
});
