import { SecretsController } from "./secrets.controller";

describe("SecretsController", () => {
	it("instantiates", () => {
		expect(new SecretsController({} as any)).toBeDefined();
	});
});
