import {
	BadRequestException,
	ConflictException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { PrivilegesController } from "./privileges.controller";

describe("PrivilegesController", () => {
	let controller: PrivilegesController;
	let mockPrivilegesService: any;
	let mockUserManagerService: any;

	beforeEach(() => {
		mockPrivilegesService = {
			registerPrivilege: jest.fn(),
			toPrivilegeList: jest.fn().mockReturnValue([]),
			isAdmin: jest.fn().mockReturnValue(false),
			updatePrivileges: jest.fn().mockResolvedValue(undefined),
		};
		mockUserManagerService = {
			findOne: jest.fn(),
		};

		controller = new PrivilegesController(
			mockPrivilegesService,
			mockUserManagerService,
		);
	});

	it("registers view-privileges on construction", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"view-privileges",
		);
	});

	describe("getUserPrivileges", () => {
		it("throws UnauthorizedException when user not found", async () => {
			mockUserManagerService.findOne.mockResolvedValue(null);
			await expect(
				controller.getUserPrivileges("missing"),
			).rejects.toThrow(UnauthorizedException);
		});

		it("returns privilege list", async () => {
			mockUserManagerService.findOne.mockResolvedValue({
				uuid: "u1",
				privileges: [{ pluginId: "", privilegeKey: "*" }],
			});
			mockPrivilegesService.toPrivilegeList.mockReturnValue([
				{ key: "*", granted: true },
			]);

			const result = await controller.getUserPrivileges("u1");
			expect(result).toEqual([{ key: "*", granted: true }]);
		});
	});

	describe("updateUserPrivileges", () => {
		it("throws NotFoundException for missing user", async () => {
			mockUserManagerService.findOne.mockResolvedValue(null);
			await expect(
				controller.updateUserPrivileges(
					"missing",
					{ privileges: [] } as any,
					{ sub: "self" } as any,
				),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ConflictException when modifying own privileges", async () => {
			mockUserManagerService.findOne.mockResolvedValue({ uuid: "self" });
			await expect(
				controller.updateUserPrivileges(
					"self",
					{ privileges: [] } as any,
					{ sub: "self" } as any,
				),
			).rejects.toThrow(ConflictException);
		});

		it("throws BadRequestException when modifying admin", async () => {
			mockUserManagerService.findOne.mockResolvedValue({ uuid: "admin" });
			mockPrivilegesService.isAdmin.mockReturnValue(true);

			await expect(
				controller.updateUserPrivileges(
					"admin",
					{ privileges: [] } as any,
					{ sub: "self" } as any,
				),
			).rejects.toThrow(BadRequestException);
		});

		it("updates privileges for valid user", async () => {
			mockUserManagerService.findOne
				.mockResolvedValueOnce({ uuid: "target" })
				.mockResolvedValueOnce({
					uuid: "target",
					privileges: [],
				});
			mockPrivilegesService.toPrivilegeList.mockReturnValue([
				{ key: "p1", granted: true },
			]);

			const result = await controller.updateUserPrivileges(
				"target",
				{ privileges: [{ key: "p1", granted: true }] } as any,
				{ sub: "self" } as any,
			);

			expect(mockPrivilegesService.updatePrivileges).toHaveBeenCalled();
			expect(result).toEqual([{ key: "p1", granted: true }]);
		});
	});
});
