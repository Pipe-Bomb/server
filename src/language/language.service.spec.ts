import { LOG_LEVELS, Logger } from "@nestjs/common";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { LanguageService } from "./language.service";

const plugin = { package: { name: "lang-plugin" } } as unknown as LoadedPlugin;

// The constructor registers the system language directory without awaiting;
// give the fs promise chain a few macrotask ticks to settle.
function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 50));
}

describe("LanguageService", () => {
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		jest.clearAllMocks();
		Logger.overrideLogger([]);
		originalCwd = process.cwd();
		tempDir = mkdtempSync(path.join(tmpdir(), "language-spec-"));
		process.chdir(tempDir);
	});

	afterEach(() => {
		Logger.overrideLogger(LOG_LEVELS);
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("loads languages from <cwd>/assets/language on construction", async () => {
		mkdirSync(path.join("assets", "language"), { recursive: true });
		writeFileSync(
			path.join("assets", "language", "en.json"),
			JSON.stringify({ greeting: "hello" }),
		);
		const service = new LanguageService();

		await settle();

		expect(service.getMap("en")).toEqual({ greeting: "hello" });
		expect(service.getIds()).toEqual(["en"]);
	});

	it("does nothing on construction when the system language directory is absent", async () => {
		const service = new LanguageService();

		await settle();

		expect(service.getIds()).toEqual([]);
	});

	it("loads one language id per .json file", async () => {
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "en.json"), JSON.stringify({ a: "one" }));
		writeFileSync(path.join(dir, "fr.json"), JSON.stringify({ a: "un" }));
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getMap("en")).toEqual({ a: "one" });
		expect(service.getMap("fr")).toEqual({ a: "un" });
		expect(service.getIds().sort()).toEqual(["en", "fr"]);
	});

	it("merges keys of the same language id across directories", async () => {
		const dirA = path.join(tempDir, "a");
		const dirB = path.join(tempDir, "b");
		mkdirSync(dirA);
		mkdirSync(dirB);
		writeFileSync(path.join(dirA, "en.json"), JSON.stringify({ first: "1" }));
		writeFileSync(path.join(dirB, "en.json"), JSON.stringify({ second: "2" }));
		const service = new LanguageService();

		await service.registerLanguageDirectory(dirA, null);
		await service.registerLanguageDirectory(dirB, plugin);

		expect(service.getMap("en")).toEqual({ first: "1", second: "2" });
		expect(service.getIds()).toEqual(["en"]);
	});

	it("ignores files without a .json extension", async () => {
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "en.json"), JSON.stringify({ a: "1" }));
		writeFileSync(path.join(dir, "readme.txt"), "not json");
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getIds()).toEqual(["en"]);
	});

	it("skips subdirectories named like language files", async () => {
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		mkdirSync(path.join(dir, "sub.json"));
		writeFileSync(path.join(dir, "en.json"), JSON.stringify({ a: "1" }));
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getIds()).toEqual(["en"]);
		expect(service.getMap("sub")).toBeNull();
	});

	it("keeps only non-empty string values", async () => {
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		writeFileSync(
			path.join(dir, "en.json"),
			JSON.stringify({ good: "ok", number: 42, empty: "", nested: { x: 1 } }),
		);
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getMap("en")).toEqual({ good: "ok" });
	});

	it("swallows unparseable JSON files and logs the error", async () => {
		const errorSpy = jest
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => {});
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "bad.json"), "{not json");
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getMap("bad")).toBeNull();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('language file "'),
			expect.any(SyntaxError),
		);
		errorSpy.mockRestore();
	});

	it("swallows JSON files that are not objects and logs the error", async () => {
		const errorSpy = jest
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => {});
		const dir = path.join(tempDir, "lang");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "arr.json"), "[1, 2, 3]");
		const service = new LanguageService();

		await service.registerLanguageDirectory(dir, null);

		expect(service.getMap("arr")).toBeNull();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("language file"),
			expect.objectContaining({ message: "Invalid language file contents" }),
		);
		errorSpy.mockRestore();
	});

	it("resolves silently when the directory does not exist", async () => {
		const service = new LanguageService();

		await expect(
			service.registerLanguageDirectory(path.join(tempDir, "nope"), null),
		).resolves.toBeUndefined();
		expect(service.getIds()).toEqual([]);
	});

	it("returns null for an unknown language id in getMap()", () => {
		const service = new LanguageService();

		expect(service.getMap("missing")).toBeNull();
	});
});
