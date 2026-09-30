import {
	ExecutionContext,
	ForbiddenException,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrivilegeGuard } from "./privilege.guard";
import { PrivilegesService } from "./privileges.service";
import { PRIVILEGES_KEY } from "./privileges.decorator";

const reflector = {
	getAllAndOverride: jest.fn(),
};
const privilegesService = {
	isAdmin: jest.fn(),
	getPrivileges: jest.fn(),
	toPrivilegeList: jest.fn(),
};

function mockContext(user?: { sub: string }): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user }) }),
		getHandler: () => () => {},
		getClass: () => class {},
	} as unknown as ExecutionContext;
}

function privilege(
	key: string,
	granted: boolean,
	grantedByInclusion: boolean,
	pluginId: string | null = null,
) {
	return { key, granted, grantedByInclusion, pluginId };
}

describe("PrivilegeGuard", () => {
	let guard: PrivilegeGuard;

	beforeEach(() => {
		jest.clearAllMocks();
		guard = new PrivilegeGuard(
			reflector as unknown as Reflector,
			privilegesService as unknown as PrivilegesService,
		);
	});

	it("allows the request when no privileges are required", async () => {
		reflector.getAllAndOverride.mockReturnValue(undefined);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).resolves.toBe(true);
		expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PRIVILEGES_KEY, [
			expect.any(Function),
			expect.anything(),
		]);
		expect(privilegesService.isAdmin).not.toHaveBeenCalled();
	});

	it("allows the request when the required privilege list is empty", async () => {
		reflector.getAllAndOverride.mockReturnValue([]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).resolves.toBe(true);
		expect(privilegesService.isAdmin).not.toHaveBeenCalled();
	});

	it("throws UnauthorizedException when no user is present", async () => {
		reflector.getAllAndOverride.mockReturnValue(["admin"]);

		await expect(guard.canActivate(mockContext())).rejects.toThrow(
			UnauthorizedException,
		);
	});

	it("allows the request for an admin", async () => {
		reflector.getAllAndOverride.mockReturnValue(["admin"]);
		privilegesService.isAdmin.mockReturnValue(true);

		await expect(
			guard.canActivate(mockContext({ sub: "owner" })),
		).resolves.toBe(true);
		expect(privilegesService.getPrivileges).not.toHaveBeenCalled();
	});

	it("allows the request when the privilege is granted", async () => {
		reflector.getAllAndOverride.mockReturnValue(["tracks.write"]);
		privilegesService.isAdmin.mockReturnValue(false);
		privilegesService.getPrivileges.mockResolvedValue([]);
		privilegesService.toPrivilegeList.mockReturnValue([
			privilege("tracks.write", true, false),
		]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).resolves.toBe(true);
	});

	it("allows the request when the privilege is granted by inclusion", async () => {
		reflector.getAllAndOverride.mockReturnValue(["tracks.write"]);
		privilegesService.isAdmin.mockReturnValue(false);
		privilegesService.getPrivileges.mockResolvedValue([]);
		privilegesService.toPrivilegeList.mockReturnValue([
			privilege("tracks.write", false, true),
		]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).resolves.toBe(true);
	});

	it("throws ForbiddenException when the privilege exists but is not granted", async () => {
		reflector.getAllAndOverride.mockReturnValue(["tracks.write"]);
		privilegesService.isAdmin.mockReturnValue(false);
		privilegesService.getPrivileges.mockResolvedValue([]);
		privilegesService.toPrivilegeList.mockReturnValue([
			privilege("tracks.write", false, false),
		]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).rejects.toThrow(ForbiddenException);
	});

	it("throws when the required privilege isn't registered", async () => {
		reflector.getAllAndOverride.mockReturnValue(["tracks.write"]);
		privilegesService.isAdmin.mockReturnValue(false);
		privilegesService.getPrivileges.mockResolvedValue([]);
		privilegesService.toPrivilegeList.mockReturnValue([
			privilege("other.privilege", true, false),
		]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).rejects.toThrow(/isn't registered/);
	});

	it("ignores plugin-scoped privileges when checking the request", async () => {
		reflector.getAllAndOverride.mockReturnValue(["tracks.write"]);
		privilegesService.isAdmin.mockReturnValue(false);
		privilegesService.getPrivileges.mockResolvedValue([]);
		privilegesService.toPrivilegeList.mockReturnValue([
			privilege("tracks.write", true, false, "plugin-a"),
		]);

		await expect(
			guard.canActivate(mockContext({ sub: "user-1" })),
		).rejects.toThrow(/isn't registered/);
	});
});
