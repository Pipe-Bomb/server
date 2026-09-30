import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { UserManagerService } from "./user-manager.service";
import { IS_AUTH_OPTIONAL_KEY } from "./optional-auth.decorator";

const userManagerService = {
	parseJwt: jest.fn(),
};
const reflector = {
	getAllAndOverride: jest.fn(),
};

function mockContext(request: Record<string, unknown>): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => () => {},
		getClass: () => class {},
	} as unknown as ExecutionContext;
}

describe("AuthGuard", () => {
	let guard: AuthGuard;

	beforeEach(() => {
		jest.clearAllMocks();
		reflector.getAllAndOverride.mockReturnValue(false);
		guard = new AuthGuard(
			userManagerService as unknown as UserManagerService,
			reflector as unknown as Reflector,
		);
	});

	it("extracts a Bearer token from the Authorization header", async () => {
		const request: Record<string, unknown> = {
			headers: { authorization: "Bearer jwt-123" },
		};
		userManagerService.parseJwt.mockResolvedValue({ sub: "user-1" });

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(userManagerService.parseJwt).toHaveBeenCalledWith("jwt-123");
		expect(request.user).toEqual({ sub: "user-1" });
	});

	it("matches the bearer prefix case-insensitively", async () => {
		const request: Record<string, unknown> = {
			headers: { authorization: "BEARER upper-token" },
		};
		userManagerService.parseJwt.mockResolvedValue({ sub: "user-1" });

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(userManagerService.parseJwt).toHaveBeenCalledWith("upper-token");
	});

	it("falls back to the auth_token cookie for non-bearer headers", async () => {
		const request: Record<string, unknown> = {
			headers: { authorization: "Basic abc" },
			cookies: { auth_token: "cookie-token" },
		};
		userManagerService.parseJwt.mockResolvedValue({ sub: "user-1" });

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(userManagerService.parseJwt).toHaveBeenCalledWith("cookie-token");
	});

	it("falls back to the auth_token cookie when the header is missing", async () => {
		const request: Record<string, unknown> = {
			headers: {},
			cookies: { auth_token: "cookie-token" },
		};
		userManagerService.parseJwt.mockResolvedValue({ sub: "user-1" });

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(userManagerService.parseJwt).toHaveBeenCalledWith("cookie-token");
	});

	it("throws UnauthorizedException when no token is available", async () => {
		const request: Record<string, unknown> = { headers: {} };

		await expect(guard.canActivate(mockContext(request))).rejects.toThrow(
			new UnauthorizedException("Authentication token missing"),
		);
		expect(userManagerService.parseJwt).not.toHaveBeenCalled();
	});

	it("allows unauthenticated requests when auth is optional", async () => {
		const request: Record<string, unknown> = { headers: {} };
		reflector.getAllAndOverride.mockReturnValue(true);

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
			IS_AUTH_OPTIONAL_KEY,
			[expect.any(Function), expect.anything()],
		);
		expect(userManagerService.parseJwt).not.toHaveBeenCalled();
		expect(request.user).toBeUndefined();
	});

	it("treats a rejected token as anonymous when auth is optional", async () => {
		const request: Record<string, unknown> = {
			headers: { authorization: "Bearer bad-token" },
		};
		reflector.getAllAndOverride.mockReturnValue(true);
		userManagerService.parseJwt.mockRejectedValue(new Error("invalid token"));

		await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
		expect(request.user).toBeUndefined();
	});

	it("rethrows when a token is invalid and auth is required", async () => {
		const request: Record<string, unknown> = {
			headers: { authorization: "Bearer bad-token" },
		};
		userManagerService.parseJwt.mockRejectedValue(new Error("invalid token"));

		await expect(guard.canActivate(mockContext(request))).rejects.toThrow(
			"invalid token",
		);
	});
});
