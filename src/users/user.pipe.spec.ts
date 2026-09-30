import { FetchUserPipe } from "./user.pipe";
import { DBUser } from "./entity/user.entity";
import { UserJwtPayload } from "./interface/user-jwt-payload.interface";
import { UserManagerService } from "src/user-manager/user-manager.service";

const userManagerService = {
	findOne: jest.fn(),
};

describe("FetchUserPipe", () => {
	let pipe: FetchUserPipe;

	beforeEach(() => {
		jest.clearAllMocks();
		pipe = new FetchUserPipe(
			userManagerService as unknown as UserManagerService,
		);
	});

	it("resolves the user for a jwt payload with a sub", async () => {
		const user = new DBUser();
		user.uuid = "user-1";
		user.username = "alice";
		userManagerService.findOne.mockResolvedValue(user);

		await expect(pipe.transform({ sub: "user-1" })).resolves.toBe(user);
		expect(userManagerService.findOne).toHaveBeenCalledWith("user-1");
	});

	it("returns undefined without calling findOne when the payload is missing", async () => {
		await expect(
			pipe.transform(undefined as unknown as UserJwtPayload),
		).resolves.toBeUndefined();
		expect(userManagerService.findOne).not.toHaveBeenCalled();
	});

	it("returns undefined without calling findOne when the payload has no sub", async () => {
		await expect(pipe.transform({} as UserJwtPayload)).resolves.toBeUndefined();
		expect(userManagerService.findOne).not.toHaveBeenCalled();
	});

	it("returns undefined when the user is not found", async () => {
		userManagerService.findOne.mockResolvedValue(undefined);

		await expect(pipe.transform({ sub: "missing" })).resolves.toBeUndefined();
	});
});
