import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { PrivilegesService } from "./privileges.service";
import { DBPrivilege } from "./entity/privilege.entity";
import { DBUser } from "src/users/entity/user.entity";

describe("PrivilegesService", () => {
	let service: PrivilegesService;
	let privilegesRepo: any;
	let usersRepo: any;
	let mockDataSource: { transaction: jest.Mock };

	beforeEach(async () => {
		privilegesRepo = {
			findBy: jest.fn(),
			find: jest.fn(),
		};
		usersRepo = {
			find: jest.fn().mockResolvedValue([]),
			update: jest.fn(),
		};
		mockDataSource = { transaction: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PrivilegesService,
				{
					provide: getRepositoryToken(DBPrivilege),
					useValue: privilegesRepo,
				},
				{
					provide: getRepositoryToken(DBUser),
					useValue: usersRepo,
				},
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get(PrivilegesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("registerPrivilege", () => {
		it("stores a system privilege", async () => {
			await service.registerPrivilege(null, "test-priv");
			expect(service.allSystemPrivileges()).toContainEqual(
				expect.objectContaining({ key: "test-priv" }),
			);
		});

		it("throws on duplicate", async () => {
			await service.registerPrivilege(null, "test-priv");
			await expect(
				service.registerPrivilege(null, "test-priv"),
			).rejects.toThrow(/already been registered/);
		});

		it("throws for non-null pluginId", async () => {
			await expect(
				service.registerPrivilege("some-plugin", "test-priv"),
			).rejects.toThrow("Not implemented");
		});

		it("validates dependencies exist", async () => {
			await expect(
				service.registerPrivilege(null, "child", ["nonexistent"]),
			).rejects.toThrow(/does not exist/);
		});

		it("stores includedIn relationships", async () => {
			await service.registerPrivilege(null, "parent");
			await service.registerPrivilege(null, "child", ["parent"]);
			const child = service
				.allSystemPrivileges()
				.find((p) => p.key === "child");
			expect(child!.includedIn).toContain("parent");
		});
	});

	describe("registerOwner", () => {
		it("adds to owner set and makes isAdmin true", () => {
			service.registerOwner("user-1");
			expect(service.isAdmin("user-1")).toBe(true);
		});
	});

	describe("isAdmin", () => {
		it("returns false for unknown user", () => {
			expect(service.isAdmin("unknown")).toBe(false);
		});
	});

	describe("getPrivileges", () => {
		it("delegates to repository", async () => {
			privilegesRepo.findBy.mockResolvedValue([{ key: "p1" }]);
			const result = await service.getPrivileges("u1");
			expect(result).toEqual([{ key: "p1" }]);
			expect(privilegesRepo.findBy).toHaveBeenCalledWith({ userUuid: "u1" });
		});
	});

	describe("toPrivilegeList", () => {
		it("includes wildcard privilege", () => {
			const result = service.toPrivilegeList("u1", []);
			expect(result[0]).toEqual(
				expect.objectContaining({ key: "*", pluginId: null }),
			);
		});

		it("grants wildcard to admin", () => {
			service.registerOwner("admin-1");
			const result = service.toPrivilegeList("admin-1", []);
			const wildcard = result.find((p) => p.key === "*")!;
			expect(wildcard.granted).toBe(true);
		});

		it("grants wildcard via explicit privilege", () => {
			const result = service.toPrivilegeList("u1", [
				{ pluginId: "", privilegeKey: "*" } as any,
			]);
			const wildcard = result.find((p) => p.key === "*")!;
			expect(wildcard.granted).toBe(true);
		});

		it("includes system privileges with inclusion chain", async () => {
			await service.registerPrivilege(null, "parent");
			await service.registerPrivilege(null, "child", ["parent"]);

			const result = service.toPrivilegeList("u1", [
				{ pluginId: "", privilegeKey: "parent" } as any,
			]);

			const child = result.find((p) => p.key === "child")!;
			expect(child.grantedByInclusion).toBe(true);
		});
	});

	describe("updatePrivileges", () => {
		it("deletes revoked and upserts granted in transaction", async () => {
			const deleteMock = jest.fn();
			const upsertMock = jest.fn();
			mockDataSource.transaction.mockImplementation(async (cb: any) => {
				const em = {
					delete: deleteMock,
					upsert: upsertMock,
				};
				return cb(em);
			});

			await service.updatePrivileges(
				{ uuid: "u1" } as any,
				[
					{ key: "grant-me", pluginId: null, granted: true } as any,
					{ key: "revoke-me", pluginId: null, granted: false } as any,
				],
			);

			expect(deleteMock).toHaveBeenCalled();
			expect(upsertMock).toHaveBeenCalled();
		});
	});
});
