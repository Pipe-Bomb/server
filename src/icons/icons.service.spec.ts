import { LOG_LEVELS, Logger } from "@nestjs/common";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { IconsService } from "./icons.service";

const plugin = { package: { name: "icon-plugin" } } as unknown as LoadedPlugin;

// Registration is fire-and-forget internally (see escalation): the returned
// promise resolves before the directory scan completes, so wait for the
// readdir/lstat chain to settle before asserting.
function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 25));
}

describe("IconsService", () => {
	let service: IconsService;
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		jest.clearAllMocks();
		Logger.overrideLogger([]);
		originalCwd = process.cwd();
		tempDir = mkdtempSync(path.join(tmpdir(), "icons-spec-"));
		process.chdir(tempDir);
		service = new IconsService();
	});

	afterEach(() => {
		Logger.overrideLogger(LOG_LEVELS);
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("registers whitelisted icons by basename", async () => {
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "logo.svg"), "<svg/>");
		writeFileSync(path.join(dir, "icon.png"), "png");
		writeFileSync(path.join(dir, "pic.jpg"), "jpg");
		writeFileSync(path.join(dir, "photo.jpeg"), "jpeg");

		void service.registerIconDirectory(dir, plugin);
		await settle();

		expect(service.getIcon("icon-plugin", "logo")).toEqual({
			id: "logo",
			path: path.join(dir, "logo.svg"),
			extension: "svg",
			plugin,
		});
		expect(service.getIcon("icon-plugin", "icon")?.extension).toBe("png");
		expect(service.getIcon("icon-plugin", "pic")?.extension).toBe("jpg");
		expect(service.getIcon("icon-plugin", "photo")?.extension).toBe("jpeg");
	});

	it("skips files with non-whitelisted extensions and warns", async () => {
		const warnSpy = jest
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "readme.txt"), "text");

		void service.registerIconDirectory(dir, plugin);
		await settle();

		expect(service.getIcon("icon-plugin", "readme")).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("extension is not whitelisted"),
		);
		warnSpy.mockRestore();
	});

	it("skips directories", async () => {
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		mkdirSync(path.join(dir, "folder.png"));

		void service.registerIconDirectory(dir, plugin);
		await settle();

		expect(service.getIcon("icon-plugin", "folder")).toBeNull();
	});

	it("registers only the first of duplicate basenames and warns", async () => {
		const warnSpy = jest
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		mkdirSync(path.join(dir, "a"));
		mkdirSync(path.join(dir, "b"));
		writeFileSync(path.join(dir, "a", "dup.svg"), "<svg/>");
		writeFileSync(path.join(dir, "b", "dup.svg"), "<svg/>");

		void service.registerIconDirectory(dir, plugin);
		await settle();

		const icon = service.getIcon("icon-plugin", "dup");
		expect(icon).not.toBeNull();
		expect(icon?.path).toMatch(/dup\.svg$/);
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Refused to register duplicate Icon"),
		);
		warnSpy.mockRestore();
	});

	it("resolves without registering anything when the directory is missing", async () => {
		void service.registerIconDirectory(path.join(tempDir, "nope"), plugin);
		await settle();

		expect(service.getIcon("icon-plugin", "anything")).toBeNull();
	});

	it("returns null for an unknown plugin", async () => {
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "logo.svg"), "<svg/>");

		void service.registerIconDirectory(dir, plugin);
		await settle();

		expect(service.getIcon("other-plugin", "logo")).toBeNull();
	});

	it("returns null for an unknown icon within a known plugin", async () => {
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "logo.svg"), "<svg/>");

		void service.registerIconDirectory(dir, plugin);
		await settle();

		expect(service.getIcon("icon-plugin", "missing")).toBeNull();
	});

	it("returns a promise that resolves before registration completes (fire-and-forget)", async () => {
		const dir = path.join(tempDir, "icons");
		mkdirSync(dir);
		writeFileSync(path.join(dir, "logo.svg"), "<svg/>");

		const pending = service.registerIconDirectory(dir, plugin);
		await pending;
		expect(service.getIcon("icon-plugin", "logo")).toBeNull();

		await settle();
		expect(service.getIcon("icon-plugin", "logo")).not.toBeNull();
	});
});
