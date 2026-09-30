import { LOG_LEVELS, Logger } from "@nestjs/common";
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "fs";
import { OpenAPIObject } from "@nestjs/swagger";
import { tmpdir } from "os";
import path from "path";
import { DocsService } from "./docs.service";

const doc = {
	openapi: "3.1.0",
	info: { title: "Pipe Bomb", version: "1.0.0" },
	paths: {},
} as unknown as OpenAPIObject;

describe("DocsService", () => {
	let service: DocsService;
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		jest.clearAllMocks();
		Logger.overrideLogger([]);
		originalCwd = process.cwd();
		tempDir = mkdtempSync(path.join(tmpdir(), "docs-spec-"));
		process.chdir(tempDir);
		service = new DocsService();
	});

	afterEach(() => {
		Logger.overrideLogger(LOG_LEVELS);
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("stores the document for getDocument()", () => {
		service.setDocument(doc);

		expect(service.getDocument()).toBe(doc);
	});

	it("returns an undefined document before setDocument()", () => {
		expect(service.getDocument()).toBeUndefined();
	});

	it("writes ./openapi/spec.json when the openapi directory exists", () => {
		mkdirSync("openapi");

		service.setDocument(doc);

		expect(readFileSync("openapi/spec.json", "utf-8")).toBe(
			JSON.stringify(doc, null, 2),
		);
	});

	it("skips writing when the openapi directory does not exist", () => {
		service.setDocument(doc);

		expect(existsSync("openapi")).toBe(false);
		expect(service.getDocument()).toBe(doc);
	});

	it("overwrites stale content in an existing spec file", () => {
		mkdirSync("openapi");
		writeFileSync("openapi/spec.json", "stale");

		service.setDocument(doc);

		expect(readFileSync("openapi/spec.json", "utf-8")).toBe(
			JSON.stringify(doc, null, 2),
		);
	});
});
