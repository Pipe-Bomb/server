import { UsersService } from "./users.service";

describe("UsersService", () => {
	it("instantiates", () => {
		expect(new UsersService()).toBeDefined();
	});
});
