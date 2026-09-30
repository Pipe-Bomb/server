describe("config constants", () => {
	function loadPort(): number {
		jest.resetModules();
		const mod = jest.requireActual<{ PORT: number }>("./constants");
		return mod.PORT;
	}

	afterEach(() => {
		delete process.env.PORT;
	});

	it("defaults PORT to 3000 when the env var is unset", () => {
		delete process.env.PORT;

		expect(loadPort()).toBe(3000);
	});

	it("parses PORT from the environment", () => {
		process.env.PORT = "4321";

		expect(loadPort()).toBe(4321);
	});
});
