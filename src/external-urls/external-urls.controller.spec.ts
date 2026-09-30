import { ExternalUrlsController } from "./external-urls.controller";

describe("ExternalUrlsController", () => {
	it("instantiates", () => {
		expect(new ExternalUrlsController({} as any)).toBeDefined();
	});
});
