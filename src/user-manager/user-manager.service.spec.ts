import * as crypto from "crypto";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FindOperator } from "typeorm";
import { SecretsService } from "src/secrets/secrets.service";
import { DBUser } from "src/users/entity/user.entity";
import { UserManagerService } from "./user-manager.service";

const mockRepo = {
	findOneBy: jest.fn(),
	findOne: jest.fn(),
	find: jest.fn(),
	create: jest.fn(),
	insert: jest.fn(),
	count: jest.fn(),
};
const mockSecrets = {
	getOrCreate: jest.fn(),
	createAuthSecret: jest.fn(),
};
const mockJwt = {
	signAsync: jest.fn(),
	verifyAsync: jest.fn(),
};

function hashPassword(password: string, salt: Buffer): string {
	return crypto
		.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
		.toString("hex");
}

function buildUser(password: string): DBUser {
	const salt = crypto.randomBytes(16);
	return {
		uuid: "user-uuid",
		username: "alice",
		passwordHash: hashPassword(password, salt),
		passwordSalt: salt.toString("hex"),
		isOwner: false,
	} as DBUser;
}

describe("UserManagerService", () => {
	let service: UserManagerService;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockSecrets.getOrCreate.mockReturnValue("jwt-secret");
		mockRepo.create.mockImplementation((data: object) => data);
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserManagerService,
				{ provide: getRepositoryToken(DBUser), useValue: mockRepo },
				{ provide: SecretsService, useValue: mockSecrets },
				{ provide: JwtService, useValue: mockJwt },
			],
		}).compile();
		service = module.get(UserManagerService);
	});

	it("loads the user-jwt secret on construction", () => {
		expect(mockSecrets.getOrCreate).toHaveBeenCalledWith(
			"user-jwt",
			expect.any(Function),
		);
	});

	describe("create()", () => {
		it("lowercases the username and inserts a scrypt-hashed user", async () => {
			mockRepo.findOneBy.mockResolvedValue(null);

			const user = await service.create("Alice", "pw123");

			expect(mockRepo.findOneBy).toHaveBeenCalledWith({ username: "alice" });
			expect(mockRepo.create).toHaveBeenCalledWith({
				username: "alice",
				passwordHash: user.passwordHash,
				passwordSalt: user.passwordSalt,
				isOwner: false,
			});
			expect(user.passwordHash).toMatch(/^[0-9a-f]{128}$/);
			expect(user.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
			expect(mockRepo.insert).toHaveBeenCalledWith(user);
		});

		it("passes the isOwner flag through", async () => {
			mockRepo.findOneBy.mockResolvedValue(null);

			await service.create("bob", "pw123", true);

			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ username: "bob", isOwner: true }),
			);
		});

		it("throws ConflictException when the username is taken", async () => {
			mockRepo.findOneBy.mockResolvedValue({ uuid: "existing" } as DBUser);

			await expect(service.create("alice", "pw123")).rejects.toThrow(
				new ConflictException("Username is taken"),
			);
			expect(mockRepo.insert).not.toHaveBeenCalled();
		});
	});

	describe("login()", () => {
		it("returns the user when the password matches", async () => {
			const user = buildUser("correct-horse");
			mockRepo.findOne.mockResolvedValue(user);

			const result = await service.login("alice", "correct-horse");

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { username: "alice" },
				relations: { privileges: true },
			});
			expect(result).toBe(user);
		});

		it("throws UnauthorizedException when the password is wrong", async () => {
			const user = buildUser("correct-horse");
			mockRepo.findOne.mockResolvedValue(user);

			await expect(service.login("alice", "wrong")).rejects.toThrow(
				new UnauthorizedException("Invalid username or password"),
			);
		});

		it("throws UnauthorizedException when the user does not exist", async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.login("ghost", "pw")).rejects.toThrow(
				new UnauthorizedException("Invalid username or password"),
			);
		});
	});

	describe("generateJwt()", () => {
		it("signs a 30-day token with the user uuid", async () => {
			mockJwt.signAsync.mockResolvedValue("token");
			const user = { uuid: "user-uuid" } as DBUser;

			await service.generateJwt(user);

			expect(mockJwt.signAsync).toHaveBeenCalledWith(
				{ sub: "user-uuid", plugin: undefined },
				{ expiresIn: "30d", secret: "jwt-secret" },
			);
		});

		it("includes the plugin id when provided", async () => {
			mockJwt.signAsync.mockResolvedValue("token");
			const user = { uuid: "user-uuid" } as DBUser;

			await service.generateJwt(user, "some-plugin");

			expect(mockJwt.signAsync).toHaveBeenCalledWith(
				{ sub: "user-uuid", plugin: "some-plugin" },
				{ expiresIn: "30d", secret: "jwt-secret" },
			);
		});
	});

	describe("parseJwt()", () => {
		it("returns the verified payload", async () => {
			mockJwt.verifyAsync.mockResolvedValue({ sub: "user-uuid" });

			expect(await service.parseJwt("jwt")).toEqual({ sub: "user-uuid" });
			expect(mockJwt.verifyAsync).toHaveBeenCalledWith("jwt", {
				secret: "jwt-secret",
			});
		});

		it("throws UnauthorizedException for an invalid token", async () => {
			mockJwt.verifyAsync.mockRejectedValue(new Error("bad token"));

			await expect(service.parseJwt("jwt")).rejects.toThrow(
				new UnauthorizedException("Invalid or expired token"),
			);
		});
	});

	describe("usernameToUuid()", () => {
		it("returns the uuid when the user exists", async () => {
			mockRepo.findOne.mockResolvedValue({ uuid: "user-uuid" } as DBUser);

			expect(await service.usernameToUuid("alice")).toBe("user-uuid");
			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { username: "alice" },
				select: ["uuid"],
			});
		});

		it("returns null when the user does not exist", async () => {
			mockRepo.findOne.mockResolvedValue(null);

			expect(await service.usernameToUuid("ghost")).toBeNull();
		});
	});

	describe("findOne()", () => {
		it("builds minimal relations by default", () => {
			mockRepo.findOne.mockResolvedValue(null);

			void service.findOne("uuid-1");

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { uuid: "uuid-1" },
				relations: { playlists: false, privileges: undefined },
			});
		});

		it("loads playlists with attributes and privileges when requested", () => {
			mockRepo.findOne.mockResolvedValue(null);

			void service.findOne("uuid-1", {
				withPlaylists: true,
				withPlaylistAttributes: true,
				withPrivileges: true,
			});

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { uuid: "uuid-1" },
				relations: { playlists: { attributes: true }, privileges: true },
			});
		});

		it("loads playlists without attributes when only withPlaylists is set", () => {
			mockRepo.findOne.mockResolvedValue(null);

			void service.findOne("uuid-1", { withPlaylists: true });

			expect(mockRepo.findOne).toHaveBeenCalledWith({
				where: { uuid: "uuid-1" },
				relations: {
					playlists: { attributes: undefined },
					privileges: undefined,
				},
			});
		});
	});

	describe("forEachUserId()", () => {
		it("iterates every user in chunked pages", async () => {
			mockRepo.find
				.mockResolvedValueOnce([{ uuid: "a" }, { uuid: "b" }])
				.mockResolvedValueOnce([]);
			const seen: string[] = [];

			await service.forEachUserId((uuid) => {
				seen.push(uuid);
			});

			expect(seen).toEqual(["a", "b"]);
			expect(mockRepo.find).toHaveBeenNthCalledWith(1, {
				take: 1_000,
				skip: 0,
				select: ["uuid"],
			});
			expect(mockRepo.find).toHaveBeenNthCalledWith(2, {
				take: 1_000,
				skip: 1_000,
				select: ["uuid"],
			});
		});

		it("stops iterating when the callback cancels", async () => {
			mockRepo.find.mockResolvedValue([{ uuid: "a" }, { uuid: "b" }]);
			const seen: string[] = [];

			await service.forEachUserId((uuid, cancel) => {
				seen.push(uuid);
				if (uuid === "a") {
					cancel();
				}
			});

			expect(seen).toEqual(["a"]);
			expect(mockRepo.find).toHaveBeenCalledTimes(1);
		});
	});

	describe("count() / all() / searchByUsername()", () => {
		it("delegates to the repository count", async () => {
			mockRepo.count.mockResolvedValue(7);

			expect(await service.count()).toBe(7);
			expect(mockRepo.count).toHaveBeenCalledTimes(1);
		});

		it("delegates to the repository find for all()", async () => {
			const users = [{ uuid: "a" }] as DBUser[];
			mockRepo.find.mockResolvedValue(users);

			expect(await service.all()).toBe(users);
			expect(mockRepo.find).toHaveBeenCalledWith();
		});

		it("searches by lowercased username with a 20-result limit", async () => {
			mockRepo.find.mockResolvedValue([]);

			await service.searchByUsername("ALICE");

			expect(mockRepo.find).toHaveBeenCalledTimes(1);
			const findArgs = (
				mockRepo.find as jest.Mock<
					Promise<DBUser[]>,
					[
						options: {
							take: number;
							where: { username: FindOperator };
						},
					]
				>
			).mock.calls[0];
			expect(findArgs[0].take).toBe(20);
			const username = findArgs[0].where.username as { value: string };
			expect(username).toBeInstanceOf(FindOperator);
			expect(username.value).toBe("%alice%");
		});
	});
});
