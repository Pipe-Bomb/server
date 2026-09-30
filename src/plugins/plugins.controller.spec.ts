import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrivilegesService } from "src/privileges/privileges.service";
import { PluginsController } from "./plugins.controller";
import { PluginsService } from "./plugins.service";
import { PluginUpdateStatus } from "./enum/plugin-update-status.enum";
import { LoadedPlugin } from "./interface/loaded-plugin.interface";

jest.mock("src/audio-cache/audio-cache.service", () => ({
	AudioCacheService: class AudioCacheService {},
}));

const mockPluginsService = {
	all: jest.fn(),
	installPlugin: jest.fn(),
	checkPluginForUpdates: jest.fn(),
	updatePlugin: jest.fn(),
	removePlugin: jest.fn(),
};
const mockPrivilegesService = {
	registerPrivilege: jest.fn(),
};

function loadedPlugin(overrides: Partial<LoadedPlugin> = {}): LoadedPlugin {
	return {
		package: { name: "fake-pkg", version: "1.0.0", description: "A plugin" },
		plugin: {},
		directoryPath: "/plugins/fake-pkg",
		updateStatus: PluginUpdateStatus.UNSUPPORTED,
		...overrides,
	} as LoadedPlugin;
}

describe("PluginsController", () => {
	let controller: PluginsController;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPluginsService.all.mockReturnValue([]);
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PluginsController],
			providers: [
				{ provide: PluginsService, useValue: mockPluginsService },
				{ provide: PrivilegesService, useValue: mockPrivilegesService },
			],
		}).compile();
		controller = module.get(PluginsController);
	});

	it("registers the plugin privileges in the constructor", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"modify-plugin-installations",
		);
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"view-plugins",
			["modify-plugin-installations"],
		);
	});

	describe("getInstalledPlugins()", () => {
		it("maps loaded plugins to responses", () => {
			mockPluginsService.all.mockReturnValue([
				loadedPlugin(),
				loadedPlugin({
					package: { name: "other-pkg", version: "2.0.0" },
					updateStatus: PluginUpdateStatus.HAS_UPDATE,
				}),
			]);

			expect(controller.getInstalledPlugins()).toEqual([
				{
					name: "fake-pkg",
					version: "1.0.0",
					description: "A plugin",
					updateStatus: PluginUpdateStatus.UNSUPPORTED,
				},
				{
					name: "other-pkg",
					version: "2.0.0",
					description: null,
					updateStatus: PluginUpdateStatus.HAS_UPDATE,
				},
			]);
		});

		it("returns an empty list when nothing is installed", () => {
			expect(controller.getInstalledPlugins()).toEqual([]);
		});
	});

	describe("install()", () => {
		it("installs the plugin and returns the installed list", async () => {
			mockPluginsService.installPlugin.mockResolvedValue("fake-pkg");
			mockPluginsService.all.mockReturnValue([loadedPlugin()]);

			const result = await controller.install({
				url: "https://git.example.com/repo.git",
				ref: "main",
			});

			expect(mockPluginsService.installPlugin).toHaveBeenCalledWith(
				"https://git.example.com/repo.git",
				"main",
			);
			expect(result).toEqual([
				{
					name: "fake-pkg",
					version: "1.0.0",
					description: "A plugin",
					updateStatus: PluginUpdateStatus.UNSUPPORTED,
				},
			]);
		});

		it("rethrows BadRequestException unchanged", async () => {
			const error = new BadRequestException("Plugin already installed");
			mockPluginsService.installPlugin.mockRejectedValue(error);

			await expect(
				controller.install({ url: "https://x.example.com" }),
			).rejects.toThrow(error);
		});

		it("wraps other errors in a BadRequestException", async () => {
			mockPluginsService.installPlugin.mockRejectedValue(
				new Error("git exploded"),
			);

			await expect(
				controller.install({ url: "https://x.example.com" }),
			).rejects.toThrow(
				new BadRequestException("Installation failed: git exploded"),
			);
		});
	});

	describe("checkUpdates()", () => {
		it("delegates to the service", async () => {
			const result = { updatesAvailable: true, commitsBehind: 3 };
			mockPluginsService.checkPluginForUpdates.mockResolvedValue(result);

			expect(await controller.checkUpdates("fake-pkg")).toBe(result);
			expect(mockPluginsService.checkPluginForUpdates).toHaveBeenCalledWith(
				"fake-pkg",
			);
		});
	});

	describe("update()", () => {
		it("updates the plugin and returns the installed list", async () => {
			mockPluginsService.updatePlugin.mockResolvedValue(undefined);
			mockPluginsService.all.mockReturnValue([loadedPlugin()]);

			const result = await controller.update("fake-pkg");

			expect(mockPluginsService.updatePlugin).toHaveBeenCalledWith("fake-pkg");
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("fake-pkg");
		});

		it("rethrows BadRequestException unchanged", async () => {
			const error = new BadRequestException("does not support updates");
			mockPluginsService.updatePlugin.mockRejectedValue(error);

			await expect(controller.update("fake-pkg")).rejects.toThrow(error);
		});

		it("rethrows NotFoundException unchanged", async () => {
			const error = new NotFoundException('Plugin "nope" is not installed');
			mockPluginsService.updatePlugin.mockRejectedValue(error);

			await expect(controller.update("nope")).rejects.toThrow(error);
		});

		it("wraps other errors in a BadRequestException", async () => {
			mockPluginsService.updatePlugin.mockRejectedValue(
				new Error("git exploded"),
			);

			await expect(controller.update("fake-pkg")).rejects.toThrow(
				new BadRequestException("Update failed: git exploded"),
			);
		});
	});

	describe("remove()", () => {
		it("throws NotFoundException when the plugin is not installed", async () => {
			mockPluginsService.removePlugin.mockResolvedValue(false);

			await expect(controller.remove("nope")).rejects.toThrow(
				new NotFoundException('Plugin "nope" is not installed'),
			);
		});

		it("removes the plugin and returns the installed list", async () => {
			mockPluginsService.removePlugin.mockResolvedValue(true);
			mockPluginsService.all.mockReturnValue([loadedPlugin()]);

			const result = await controller.remove("fake-pkg");

			expect(mockPluginsService.removePlugin).toHaveBeenCalledWith("fake-pkg");
			expect(result).toHaveLength(1);
		});
	});
});
