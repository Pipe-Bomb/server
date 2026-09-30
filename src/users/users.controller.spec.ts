import { ForbiddenException, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { UsersController } from "./users.controller";

describe("UsersController", () => {
	let controller: UsersController;
	let mockUserManagerService: any;
	let mockPrivilegesService: any;
	let mockSystemConfigService: any;

	beforeEach(() => {
		mockUserManagerService = {
			all: jest.fn(),
			login: jest.fn(),
			generateJwt: jest.fn(),
			count: jest.fn(),
			create: jest.fn(),
			findOne: jest.fn(),
			searchByUsername: jest.fn(),
		};
		mockPrivilegesService = {
			registerPrivilege: jest.fn(),
			registerOwner: jest.fn(),
			toPrivilegeList: jest.fn().mockReturnValue([]),
		};
		mockSystemConfigService = {
			registerOption: jest.fn(),
			getOption: jest.fn(),
		};

		controller = new UsersController(
			mockUserManagerService,
			mockPrivilegesService,
			mockSystemConfigService,
		);
	});

	it("registers system config option on construction", () => {
		expect(mockSystemConfigService.registerOption).toHaveBeenCalledWith(
			"allow-user-registrations",
			"boolean",
			expect.any(Object),
			true,
		);
	});

	describe("getAllUsers", () => {
		it("returns user responses", async () => {
			mockUserManagerService.all.mockResolvedValue([
				{ toResponse: () => ({ uuid: "u1" }) },
			]);
			const result = await controller.getAllUsers();
			expect(result).toEqual([{ uuid: "u1" }]);
		});
	});

	describe("login", () => {
		it("returns user and sets cookie", async () => {
			const user = {
				uuid: "u1",
				privileges: [],
				toResponse: jest.fn().mockReturnValue({ uuid: "u1" }),
			};
			mockUserManagerService.login.mockResolvedValue(user);
			mockUserManagerService.generateJwt.mockResolvedValue("jwt-token");

			const response = { cookie: jest.fn() };
			const result = await controller.login(
				{ secure: false } as any,
				{ username: "admin", password: "pass" } as any,
				response,
			);

			expect(result).toEqual({ uuid: "u1" });
			expect(response.cookie).toHaveBeenCalledWith(
				"auth_token",
				"jwt-token",
				expect.objectContaining({ httpOnly: true }),
			);
		});
	});

	describe("signup", () => {
		it("allows first user registration", async () => {
			mockUserManagerService.count.mockResolvedValue(0);
			const user = {
				uuid: "u1",
				privileges: [],
				toResponse: jest.fn().mockReturnValue({ uuid: "u1" }),
			};
			mockUserManagerService.create.mockResolvedValue(user);
			mockUserManagerService.generateJwt.mockResolvedValue("jwt");

			const response = { cookie: jest.fn() };
			await controller.signup(
				{ secure: false } as any,
				{ username: "first", password: "pass" } as any,
				response,
			);

			expect(mockPrivilegesService.registerOwner).toHaveBeenCalledWith("u1");
		});

		it("blocks registration when disabled and not first user", async () => {
			mockUserManagerService.count.mockResolvedValue(5);
			mockSystemConfigService.getOption.mockResolvedValue(false);

			await expect(
				controller.signup(
					{ secure: false } as any,
					{ username: "later", password: "pass" } as any,
					{ cookie: jest.fn() },
				),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("getSelf", () => {
		it("throws UnauthorizedException when user not found", async () => {
			mockUserManagerService.findOne.mockResolvedValue(null);
			await expect(
				controller.getSelf({ sub: "u1" } as any),
			).rejects.toThrow(UnauthorizedException);
		});

		it("returns user response", async () => {
			const user = {
				uuid: "u1",
				privileges: [],
				toResponse: jest.fn().mockReturnValue({ uuid: "u1" }),
			};
			mockUserManagerService.findOne.mockResolvedValue(user);
			const result = await controller.getSelf({ sub: "u1" } as any);
			expect(result).toEqual({ uuid: "u1" });
		});
	});

	describe("logout", () => {
		it("clears the auth cookie", () => {
			const response = { clearCookie: jest.fn() };
			controller.logout({ secure: false } as any, response);
			expect(response.clearCookie).toHaveBeenCalledWith(
				"auth_token",
				expect.objectContaining({ httpOnly: true }),
			);
		});
	});

	describe("searchUsers", () => {
		it("returns empty for blank query", async () => {
			await expect(controller.searchUsers("  ")).resolves.toEqual([]);
			expect(mockUserManagerService.searchByUsername).not.toHaveBeenCalled();
		});

		it("searches by username", async () => {
			mockUserManagerService.searchByUsername.mockResolvedValue([
				{ toResponse: () => ({ uuid: "u1" }) },
			]);
			const result = await controller.searchUsers("admin");
			expect(result).toEqual([{ uuid: "u1" }]);
		});
	});

	describe("getUser", () => {
		it("throws NotFoundException for missing user", async () => {
			mockUserManagerService.findOne.mockResolvedValue(null);
			await expect(
				controller.getUser("missing", undefined),
			).rejects.toThrow(NotFoundException);
		});
	});
});
