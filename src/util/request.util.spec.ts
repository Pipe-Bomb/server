import { Request } from "express";
import { getBaseUrl } from "./request.util";

describe("getBaseUrl", () => {
	let originalBasePath: string | undefined;

	beforeEach(() => {
		originalBasePath = process.env.BASE_PATH;
		delete process.env.BASE_PATH;
		jest.clearAllMocks();
	});

	afterEach(() => {
		if (originalBasePath === undefined) {
			delete process.env.BASE_PATH;
		} else {
			process.env.BASE_PATH = originalBasePath;
		}
	});

	function makeRequest(
		headers: Record<string, string>,
		protocol = "https",
	): Request {
		return {
			protocol,
			get: jest.fn((name: string) => headers[name]),
		} as unknown as Request;
	}

	it("uses the first x-forwarded-proto and x-forwarded-host entries", () => {
		const request = makeRequest({
			"x-forwarded-proto": "https, http",
			"x-forwarded-host": "example.com, fallback.example.com",
		});

		expect(getBaseUrl(request)).toBe("https://example.com");
	});

	it("trims the first forwarded header entry", () => {
		const request = makeRequest({
			"x-forwarded-proto": " http ",
			"x-forwarded-host": " spaced.example.com , other",
		});

		expect(getBaseUrl(request)).toBe("http://spaced.example.com");
	});

	it("falls back to request.protocol and the host header", () => {
		const request = makeRequest({ host: "plain.example.com" }, "http");

		expect(getBaseUrl(request)).toBe("http://plain.example.com");
	});

	it("throws when no host is resolvable", () => {
		expect(() => getBaseUrl(makeRequest({}))).toThrow("Host not specified");
	});

	it("returns protocol://host when BASE_PATH is unset", () => {
		const request = makeRequest({ host: "example.com" });

		expect(getBaseUrl(request)).toBe("https://example.com");
	});

	it('returns protocol://host when BASE_PATH is "/"', () => {
		process.env.BASE_PATH = "/";

		expect(getBaseUrl(makeRequest({ host: "example.com" }))).toBe(
			"https://example.com",
		);
	});

	it("inserts a slash before a BASE_PATH that does not start with one", () => {
		process.env.BASE_PATH = "admin";

		expect(getBaseUrl(makeRequest({ host: "example.com" }))).toBe(
			"https://example.com/admin",
		);
	});

	it("appends a slash-prefixed BASE_PATH as-is", () => {
		process.env.BASE_PATH = "/admin/panel";

		expect(getBaseUrl(makeRequest({ host: "example.com" }))).toBe(
			"https://example.com/admin/panel",
		);
	});
});
