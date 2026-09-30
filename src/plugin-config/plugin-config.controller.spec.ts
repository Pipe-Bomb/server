import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigNode } from "@sdk";
import { DBUser } from "src/users/entity/user.entity";
import { PrivilegesService } from "src/privileges/privileges.service";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { PluginConfigController } from "./plugin-config.controller";
import { PluginConfigService } from "./plugin-config.service";
import { ConfigNodeType } from "./enum/config-node-type.enum";
import { HeadingConfigNodeSize } from "./enum/heading-config-node-size.enum";

const mockConfigService = {
	allPluginConfigs: jest.fn(),
	allUserConfigs: jest.fn(),
	findPluginConfig: jest.fn(),
	findUserConfig: jest.fn(),
};
const mockPrivilegesService = {
	registerPrivilege: jest.fn(),
};
const mockUserManagerService = {
	findOne: jest.fn(),
};

const user = { uuid: "user-1" } as DBUser;

describe("PluginConfigController", () => {
	let controller: PluginConfigController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PluginConfigController],
			providers: [
				{ provide: PluginConfigService, useValue: mockConfigService },
				{ provide: PrivilegesService, useValue: mockPrivilegesService },
				{ provide: UserManagerService, useValue: mockUserManagerService },
			],
		}).compile();
		controller = module.get(PluginConfigController);
	});

	it("registers the plugin config privileges in the constructor", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"view-plugin-configs",
		);
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"edit-plugin-configs",
		);
	});

	describe("getAllPluginConfigs()", () => {
		it("maps each registered manager to its plugin id", () => {
			mockConfigService.allPluginConfigs.mockReturnValue([
				{ plugin: { package: { name: "plugin-a" } } },
				{ plugin: { package: { name: "plugin-b" } } },
			]);

			expect(controller.getAllPluginConfigs()).toEqual({
				configs: [{ id: "plugin-a" }, { id: "plugin-b" }],
			});
		});

		it("returns an empty list when nothing is registered", () => {
			mockConfigService.allPluginConfigs.mockReturnValue([]);

			expect(controller.getAllPluginConfigs()).toEqual({ configs: [] });
		});
	});

	describe("getAllUserConfigs()", () => {
		it("filters configs the user cannot access", () => {
			mockConfigService.allUserConfigs.mockReturnValue([
				{
					configManager: { canUserAccess: () => true },
					plugin: { package: { name: "plugin-a" } },
					id: "cfg-a",
				},
				{
					configManager: { canUserAccess: () => false },
					plugin: { package: { name: "plugin-b" } },
					id: "cfg-b",
				},
			]);

			expect(controller.getAllUserConfigs(user)).toEqual({
				configs: [{ pluginId: "plugin-a", configId: "cfg-a" }],
			});
		});
	});

	describe("getPluginConfig()", () => {
		it("throws NotFoundException when no config is registered", async () => {
			mockConfigService.findPluginConfig.mockReturnValue(null);

			await expect(controller.getPluginConfig("nope")).rejects.toThrow(
				NotFoundException,
			);
		});

		it("maps heading nodes with their size", async () => {
			const rootNode = {
				type: "section",
				children: [
					{ type: "heading", size: "sm", content: "Small" },
					{ type: "heading", size: "md", content: "Medium" },
					{ type: "heading", size: "lg", content: "Large" },
				],
			} as ConfigNode;
			mockConfigService.findPluginConfig.mockReturnValue({
				configManager: {
					getConfigOptions: jest.fn().mockResolvedValue(rootNode),
				},
			});

			const result = await controller.getPluginConfig("plugin-a");

			expect(result).toEqual({
				node: {
					type: ConfigNodeType.SECTION,
					children: [
						{
							type: ConfigNodeType.HEADING,
							size: HeadingConfigNodeSize.SM,
							content: "Small",
						},
						{
							type: ConfigNodeType.HEADING,
							size: HeadingConfigNodeSize.MD,
							content: "Medium",
						},
						{
							type: ConfigNodeType.HEADING,
							size: HeadingConfigNodeSize.LG,
							content: "Large",
						},
					],
				},
			});
		});

		it("maps text, paragraph and nested section nodes", async () => {
			const rootNode = {
				type: "section",
				children: [
					{
						type: "text",
						id: "field",
						name: "Field",
						value: "v",
						placeholder: "hint",
					},
					{
						type: "text",
						id: "field-2",
						name: "Field 2",
						value: "v",
						placeholder: null,
					},
					{ type: "paragraph", content: "Some text" },
					{ type: "section", children: [] },
				],
			} as ConfigNode;
			mockConfigService.findPluginConfig.mockReturnValue({
				configManager: {
					getConfigOptions: jest.fn().mockResolvedValue(rootNode),
				},
			});

			const result = await controller.getPluginConfig("plugin-a");

			expect(result.node).toEqual({
				type: ConfigNodeType.SECTION,
				children: [
					{
						type: ConfigNodeType.TEXT,
						id: "field",
						name: "Field",
						value: "v",
						placeholder: "hint",
					},
					{
						type: ConfigNodeType.TEXT,
						id: "field-2",
						name: "Field 2",
						value: "v",
						placeholder: null,
					},
					{
						type: ConfigNodeType.PARAGRAPH,
						content: "Some text",
					},
					{ type: ConfigNodeType.SECTION, children: [] },
				],
			});
		});
	});

	describe("getUserConfig()", () => {
		it("throws NotFoundException when no config is registered", async () => {
			mockConfigService.findUserConfig.mockReturnValue(null);

			await expect(
				controller.getUserConfig("nope", "cfg", user),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ForbiddenException when the user cannot access the config", async () => {
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: { canUserAccess: () => false },
			});

			await expect(
				controller.getUserConfig("plugin-a", "cfg", user),
			).rejects.toThrow(ForbiddenException);
		});

		it("throws ForbiddenException when the root node is null", async () => {
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: {
					canUserAccess: () => true,
					getConfigOptions: jest.fn().mockResolvedValue(null),
				},
			});

			await expect(
				controller.getUserConfig("plugin-a", "cfg", user),
			).rejects.toThrow(ForbiddenException);
		});

		it("returns the node for an accessible config", async () => {
			const rootNode = {
				type: "paragraph",
				content: "hello",
			} as ConfigNode;
			const getConfigOptions = jest.fn().mockResolvedValue(rootNode);
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: { canUserAccess: () => true, getConfigOptions },
			});

			const result = await controller.getUserConfig("plugin-a", "cfg", user);

			expect(getConfigOptions).toHaveBeenCalledWith("user-1");
			expect(result).toEqual({
				node: { type: ConfigNodeType.PARAGRAPH, content: "hello" },
			});
		});
	});

	describe("updatePluginConfig()", () => {
		it("throws NotFoundException when no config is registered", async () => {
			mockConfigService.findPluginConfig.mockReturnValue(null);

			await expect(
				controller.updatePluginConfig("nope", { values: {} }),
			).rejects.toThrow(NotFoundException);
		});

		it("passes the dto values to the manager and returns the node", async () => {
			const rootNode = { type: "paragraph", content: "ok" } as ConfigNode;
			const update = jest.fn().mockResolvedValue(rootNode);
			mockConfigService.findPluginConfig.mockReturnValue({
				configManager: { update },
			});

			const result = await controller.updatePluginConfig("plugin-a", {
				values: { key: "value" },
			});

			expect(update).toHaveBeenCalledWith({ key: "value" });
			expect(result).toEqual({
				node: { type: ConfigNodeType.PARAGRAPH, content: "ok" },
			});
		});
	});

	describe("updateUserConfig()", () => {
		it("throws NotFoundException when no config is registered", async () => {
			mockConfigService.findUserConfig.mockReturnValue(null);

			await expect(
				controller.updateUserConfig("nope", "cfg", user, { values: {} }),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ForbiddenException when the user cannot access the config", async () => {
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: { canUserAccess: () => false },
			});

			await expect(
				controller.updateUserConfig("plugin-a", "cfg", user, { values: {} }),
			).rejects.toThrow(ForbiddenException);
		});

		it("throws ForbiddenException when the root node is null", async () => {
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: {
					canUserAccess: () => true,
					update: jest.fn().mockResolvedValue(null),
				},
			});

			await expect(
				controller.updateUserConfig("plugin-a", "cfg", user, {
					values: { key: "value" },
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("passes the user uuid and values to the manager and returns the node", async () => {
			const rootNode = { type: "paragraph", content: "ok" } as ConfigNode;
			const update = jest.fn().mockResolvedValue(rootNode);
			mockConfigService.findUserConfig.mockReturnValue({
				configManager: { canUserAccess: () => true, update },
			});

			const result = await controller.updateUserConfig(
				"plugin-a",
				"cfg",
				user,
				{
					values: { key: "value" },
				},
			);

			expect(update).toHaveBeenCalledWith("user-1", { key: "value" });
			expect(result).toEqual({
				node: { type: ConfigNodeType.PARAGRAPH, content: "ok" },
			});
		});
	});
});
