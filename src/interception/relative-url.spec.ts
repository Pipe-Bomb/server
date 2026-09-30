import { RelativeUrl } from "./relative-url";

describe("RelativeUrl", () => {
	it("stores the url as a readonly property", () => {
		const relativeUrl = new RelativeUrl("/resources/abc.mp3");

		expect(relativeUrl).toBeInstanceOf(RelativeUrl);
		expect(relativeUrl.url).toBe("/resources/abc.mp3");
	});

	it("preserves an empty url", () => {
		expect(new RelativeUrl("").url).toBe("");
	});
});
