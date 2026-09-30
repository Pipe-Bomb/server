/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigManager, UserConfigManager } from "@sdk";
import { DBConfigEntry } from "./entity/config-entry.entity";
import { DBUserConfigEntry } from "./entity/user-config-entry.entity";
import { PluginConfigService } from "./plugin-config.service";
import { LoadedPlugin } from "src/plugins/interface/loaded-plugin.interface";
import { PluginUpdateStatus } from "src/plugins/enum/plugin-update-status.enum";

const mockConfigRepo = {
	find: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
	insert: jest.fn(),
};
const mockUserConfigRepo = {
	find: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
	insert: jest.fn(),
};

function plugin(overrides: Partial<LoadedPlugin> = {}): LoadedPlugin {
	return {
		package: { name: "fake-pkg", version: "1.0.0" },
		plugin: {},
		directoryPath: "/plugins/fake-pkg",
		updateStatus: PluginUpdateStatus.UNSUPPORTED,
		...overrides,
	} as LoadedPlugin;
}

function configEntry(overrides: Partial<DBConfigEntry> = {}): DBConfigEntry {
	return {
		pluginId: "fake-pkg",
		key: "key",
		ordinal: 0,
		value_string: null,
		value_int: null,
		value_decimal: null,
		value_boolean: null,
		...overrides,
	} as DBConfigEntry;
}

function userConfigEntry(
	overrides: Partial<DBUserConfigEntry> = {},
): DBUserConfigEntry {
	return {
		pluginId: "fake-pkg",
		configId: "cfg",
		key: "key",
		ordinal: 0,
		userUuid: "user-1",
		value_string: null,
		value_int: null,
		value_decimal: null,
		value_boolean: null,
		...overrides,
	} as DBUserConfigEntry;
}

type ConfigContext = Parameters<ConfigManager["enable"]>[0];
type UserConfigContext = Parameters<UserConfigManager["enable"]>[0];

describe("PluginConfigService", () => {
	let service: PluginConfigService;
	let errorSpy: jest.SpyInstance;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PluginConfigService,
				{
					provide: getRepositoryToken(DBConfigEntry),
					useValue: mockConfigRepo,
				},
				{
					provide: getRepositoryToken(DBUserConfigEntry),
					useValue: mockUserConfigRepo,
				},
			],
		}).compile();
		service = module.get(PluginConfigService);
		errorSpy = jest
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
	});

	describe("registerConfigManager()", () => {
		it("enables the manager with a context and stores it", async () => {
			const configManager = { enable: jest.fn().mockResolvedValue(undefined) };

			await service.registerConfigManager(
				configManager as ConfigManager,
				plugin(),
			);

			expect(configManager.enable).toHaveBeenCalledTimes(1);
			const context = configManager.enable.mock.calls[0][0] as ConfigContext;
			expect(typeof context.getValue).toBe("function");
			expect(typeof context.setValue).toBe("function");
			expect(typeof context.delete).toBe("function");
			expect(service.findPluginConfig("fake-pkg")).toEqual({
				configManager,
				plugin: expect.objectContaining({
					package: expect.objectContaining({ name: "fake-pkg" }),
				}),
			});
		});

		it("throws when the plugin already registered a config manager", async () => {
			const first = { enable: jest.fn().mockResolvedValue(undefined) };
			const second = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerConfigManager(first as ConfigManager, plugin());

			await expect(
				service.registerConfigManager(second as ConfigManager, plugin()),
			).rejects.toThrow("Plugin has already registered a Config Manager");
			expect(second.enable).not.toHaveBeenCalled();
		});

		it("swallows enable errors and does not store the manager", async () => {
			const configManager = {
				enable: jest.fn().mockRejectedValue(new Error("boom")),
			};

			await service.registerConfigManager(
				configManager as ConfigManager,
				plugin(),
			);

			expect(service.findPluginConfig("fake-pkg")).toBeNull();
			expect(errorSpy).toHaveBeenCalled();
		});
	});

	describe("config manager context", () => {
		let context: ConfigContext;

		beforeEach(async () => {
			const configManager = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerConfigManager(
				configManager as ConfigManager,
				plugin(),
			);
			context = configManager.enable.mock.calls[0][0] as ConfigContext;
		});

		it("getValue returns null when there are no entries", async () => {
			mockConfigRepo.find.mockResolvedValue([]);

			expect(await context.getValue("key", "string")).toBeNull();
			expect(mockConfigRepo.find).toHaveBeenCalledWith({
				where: { pluginId: "fake-pkg", key: "key" },
				order: { ordinal: "asc" },
			});
		});

		it("getValue extracts the typed value", async () => {
			mockConfigRepo.find.mockResolvedValue([
				configEntry({ value_string: "stored" }),
			]);

			expect(await context.getValue("key", "string")).toBe("stored");

			mockConfigRepo.find.mockResolvedValue([configEntry({ value_int: 7 })]);
			expect(await context.getValue("key", "integer")).toBe(7);

			mockConfigRepo.find.mockResolvedValue([
				configEntry({ value_boolean: true }),
			]);
			expect(await context.getValue("key", "boolean")).toBe(true);

			mockConfigRepo.find.mockResolvedValue([
				configEntry({ value_decimal: 1.5 }),
			]);
			expect(await context.getValue("key", "decimal")).toBe(1.5);
		});

		it("getValue returns all values when multiple is true", async () => {
			mockConfigRepo.find.mockResolvedValue([
				configEntry({ ordinal: 0, value_string: "a" }),
				configEntry({ ordinal: 1, value_string: "b" }),
			]);

			expect(await context.getValue("key", "string", true)).toEqual(["a", "b"]);
		});

		it("getValue filters out null values", async () => {
			mockConfigRepo.find.mockResolvedValue([
				configEntry({ ordinal: 0, value_string: null }),
				configEntry({ ordinal: 1, value_string: "b" }),
			]);

			expect(await context.getValue("key", "string")).toBe("b");

			mockConfigRepo.find.mockResolvedValue([
				configEntry({ value_string: null }),
			]);
			expect(await context.getValue("key", "string")).toBeNull();
		});

		it("setValue wraps a scalar and persists typed entries", async () => {
			mockConfigRepo.create.mockImplementation((data: object) => data);

			await context.setValue("key", "string", "v");

			expect(mockConfigRepo.create).toHaveBeenCalledWith({
				pluginId: "fake-pkg",
				key: "key",
				ordinal: 0,
				value_boolean: null,
				value_decimal: null,
				value_int: null,
				value_string: "v",
			});
			expect(mockConfigRepo.delete).toHaveBeenCalledWith({
				pluginId: "fake-pkg",
				key: "key",
			});
			expect(mockConfigRepo.insert).toHaveBeenCalledTimes(1);
			expect(mockConfigRepo.insert.mock.calls[0][0]).toHaveLength(1);
		});

		it("setValue persists arrays with their ordinals", async () => {
			mockConfigRepo.create.mockImplementation((data: object) => data);

			await context.setValue("key", "integer", [1, 2]);

			expect(mockConfigRepo.create).toHaveBeenNthCalledWith(1, {
				pluginId: "fake-pkg",
				key: "key",
				ordinal: 0,
				value_boolean: null,
				value_decimal: null,
				value_int: 1,
				value_string: null,
			});
			expect(mockConfigRepo.create).toHaveBeenNthCalledWith(2, {
				pluginId: "fake-pkg",
				key: "key",
				ordinal: 1,
				value_boolean: null,
				value_decimal: null,
				value_int: 2,
				value_string: null,
			});
			expect(mockConfigRepo.insert).toHaveBeenCalledTimes(1);
			expect(mockConfigRepo.insert.mock.calls[0][0]).toHaveLength(2);
		});

		it("delete removes all entries for the key", async () => {
			await context.delete("key");

			expect(mockConfigRepo.delete).toHaveBeenCalledWith({
				pluginId: "fake-pkg",
				key: "key",
			});
		});
	});

	describe("registerUserConfigManager()", () => {
		it("enables the manager with a context and stores it under its id", async () => {
			const configManager = { enable: jest.fn().mockResolvedValue(undefined) };

			await service.registerUserConfigManager(
				"cfg",
				configManager as UserConfigManager,
				plugin(),
			);

			const context = configManager.enable.mock
				.calls[0][0] as UserConfigContext;
			expect(typeof context.getValue).toBe("function");
			expect(typeof context.getAllValues).toBe("function");
			expect(typeof context.setValue).toBe("function");
			expect(typeof context.delete).toBe("function");
			expect(service.findUserConfig("fake-pkg", "cfg")).toEqual({
				configManager,
				plugin: expect.objectContaining({
					package: expect.objectContaining({ name: "fake-pkg" }),
				}),
				id: "cfg",
			});
		});

		it("throws when the id is already registered for the plugin", async () => {
			const first = { enable: jest.fn().mockResolvedValue(undefined) };
			const second = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerUserConfigManager(
				"cfg",
				first as UserConfigManager,
				plugin(),
			);

			await expect(
				service.registerUserConfigManager(
					"cfg",
					second as UserConfigManager,
					plugin(),
				),
			).rejects.toThrow(
				'Plugin has already registered a User Config Manager with ID "cfg"',
			);
			expect(second.enable).not.toHaveBeenCalled();
		});

		it("allows the same id for different plugins", async () => {
			const configManager = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerUserConfigManager(
				"cfg",
				configManager as UserConfigManager,
				plugin(),
			);

			await expect(
				service.registerUserConfigManager(
					"cfg",
					configManager as UserConfigManager,
					plugin({ package: { name: "other-pkg", version: "1.0.0" } }),
				),
			).resolves.not.toThrow();
		});

		it("swallows enable errors and does not store the manager", async () => {
			const configManager = {
				enable: jest.fn().mockRejectedValue(new Error("boom")),
			};

			await service.registerUserConfigManager(
				"cfg",
				configManager as UserConfigManager,
				plugin(),
			);

			expect(service.findUserConfig("fake-pkg", "cfg")).toBeNull();
			expect(errorSpy).toHaveBeenCalled();
		});
	});

	describe("user config manager context", () => {
		let context: UserConfigContext;

		beforeEach(async () => {
			const configManager = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerUserConfigManager(
				"cfg",
				configManager as UserConfigManager,
				plugin(),
			);
			context = configManager.enable.mock.calls[0][0] as UserConfigContext;
		});

		it("getValue is scoped by user, plugin and config id", async () => {
			mockUserConfigRepo.find.mockResolvedValue([
				userConfigEntry({ value_string: "stored" }),
			]);

			expect(await context.getValue("user-1", "key", "string")).toBe("stored");
			expect(mockUserConfigRepo.find).toHaveBeenCalledWith({
				where: {
					userUuid: "user-1",
					pluginId: "fake-pkg",
					configId: "cfg",
					key: "key",
				},
				order: { ordinal: "asc" },
			});
		});

		it("getValue returns null when there are no entries", async () => {
			mockUserConfigRepo.find.mockResolvedValue([]);

			expect(await context.getValue("user-1", "key", "string")).toBeNull();
		});

		it("getAllValues groups values by user and skips null values", async () => {
			mockUserConfigRepo.find.mockResolvedValue([
				userConfigEntry({ userUuid: "user-a", ordinal: 0, value_string: "x" }),
				userConfigEntry({ userUuid: "user-a", ordinal: 1, value_string: "y" }),
				userConfigEntry({ userUuid: "user-b", ordinal: 0, value_string: "z" }),
				userConfigEntry({ userUuid: "user-c", ordinal: 0, value_string: null }),
			]);

			const result = await context.getAllValues("key", "string");

			expect(mockUserConfigRepo.find).toHaveBeenCalledWith({
				where: {
					pluginId: "fake-pkg",
					key: "key",
					configId: "cfg",
				},
				order: { ordinal: "asc" },
			});
			expect(result).toEqual([
				{ userUuid: "user-a", value: ["x", "y"] },
				{ userUuid: "user-b", value: ["z"] },
			]);
		});

		it("setValue is scoped by user, plugin and config id", async () => {
			mockUserConfigRepo.create.mockImplementation((data: object) => data);

			await context.setValue("user-1", "key", "string", "v");

			expect(mockUserConfigRepo.create).toHaveBeenCalledWith({
				userUuid: "user-1",
				pluginId: "fake-pkg",
				configId: "cfg",
				key: "key",
				ordinal: 0,
				value_boolean: null,
				value_decimal: null,
				value_int: null,
				value_string: "v",
			});
			expect(mockUserConfigRepo.delete).toHaveBeenCalledWith({
				userUuid: "user-1",
				pluginId: "fake-pkg",
				configId: "cfg",
				key: "key",
			});
		});

		it("delete is scoped by user, plugin and config id", async () => {
			await context.delete("user-1", "key");

			expect(mockUserConfigRepo.delete).toHaveBeenCalledWith({
				userUuid: "user-1",
				pluginId: "fake-pkg",
				key: "key",
				configId: "cfg",
			});
		});
	});

	describe("listing and lookup", () => {
		it("allPluginConfigs returns the registered managers", async () => {
			const manager = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerConfigManager(manager as ConfigManager, plugin());

			expect(service.allPluginConfigs()).toHaveLength(1);
		});

		it("allUserConfigs flattens managers across plugins", async () => {
			const manager = { enable: jest.fn().mockResolvedValue(undefined) };
			await service.registerUserConfigManager(
				"cfg-1",
				manager as UserConfigManager,
				plugin(),
			);
			await service.registerUserConfigManager(
				"cfg-2",
				manager as UserConfigManager,
				plugin(),
			);

			expect(service.allUserConfigs()).toHaveLength(2);
		});

		it("findPluginConfig returns null for unknown plugins", () => {
			expect(service.findPluginConfig("nope")).toBeNull();
		});

		it("findUserConfig returns null for unknown configs", () => {
			expect(service.findUserConfig("nope", "cfg")).toBeNull();
		});
	});
});
