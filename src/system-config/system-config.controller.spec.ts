import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrivilegesService } from "src/privileges/privileges.service";
import { SystemConfigType } from "./enum/system-config-type.enum";
import { SystemConfigController } from "./system-config.controller";
import { SystemConfigService } from "./system-config.service";

const mockSystemConfigService = {
	isRegistered: jest.fn(),
	getOptions: jest.fn(),
	getRegisteredOption: jest.fn(),
	updateOptions: jest.fn(),
};
const mockPrivilegesService = {
	registerPrivilege: jest.fn(),
};

describe("SystemConfigController", () => {
	let controller: SystemConfigController;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SystemConfigController],
			providers: [
				{ provide: SystemConfigService, useValue: mockSystemConfigService },
				{ provide: PrivilegesService, useValue: mockPrivilegesService },
			],
		}).compile();
		controller = module.get(SystemConfigController);
	});

	it("registers the edit and view privileges on construction", () => {
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"edit-system-config",
		);
		expect(mockPrivilegesService.registerPrivilege).toHaveBeenCalledWith(
			null,
			"view-system-config",
			["edit-system-config"],
		);
	});

	describe("getOptions()", () => {
		it("throws BadRequestException when a key is not a valid option", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(false);

			await expect(controller.getOptions({ keys: ["nope"] })).rejects.toThrow(
				new BadRequestException('Key "nope" is not a valid option'),
			);
			expect(mockSystemConfigService.getOptions).not.toHaveBeenCalled();
		});

		it("maps string options including length constraints", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(true);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "string", supportsMultiple: false, value: ["v"] },
			]);
			mockSystemConfigService.getRegisteredOption.mockReturnValue({
				type: "string",
				options: { supportsMultiple: false, minLength: 2, maxLength: 10 },
				defaultValues: ["d"],
			});

			const result = await controller.getOptions({ keys: ["k"] });

			expect(mockSystemConfigService.getOptions).toHaveBeenCalledWith(["k"]);
			expect(result).toEqual({
				options: [
					{
						type: SystemConfigType.STRING,
						key: "k",
						supportsMultiple: false,
						values: ["v"],
						minLength: 2,
						maxLength: 10,
					},
				],
			});
		});

		it("maps integer options including min/max constraints", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(true);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "integer", supportsMultiple: true, value: [1, 2] },
			]);
			mockSystemConfigService.getRegisteredOption.mockReturnValue({
				type: "integer",
				options: { supportsMultiple: true, min: 0, max: 5 },
				defaultValues: [1],
			});

			const result = await controller.getOptions({ keys: ["k"] });

			expect(result).toEqual({
				options: [
					{
						type: SystemConfigType.INTEGER,
						key: "k",
						supportsMultiple: true,
						values: [1, 2],
						min: 0,
						max: 5,
					},
				],
			});
		});

		it("maps decimal options including min/max constraints", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(true);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "decimal", supportsMultiple: false, value: [0.5] },
			]);
			mockSystemConfigService.getRegisteredOption.mockReturnValue({
				type: "decimal",
				options: { supportsMultiple: false, min: 0, max: 1 },
				defaultValues: [0.5],
			});

			const result = await controller.getOptions({ keys: ["k"] });

			expect(result).toEqual({
				options: [
					{
						type: SystemConfigType.DECIMAL,
						key: "k",
						supportsMultiple: false,
						values: [0.5],
						min: 0,
						max: 1,
					},
				],
			});
		});

		it("maps boolean options", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(true);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "boolean", supportsMultiple: false, value: [true] },
			]);
			mockSystemConfigService.getRegisteredOption.mockReturnValue({
				type: "boolean",
				options: { supportsMultiple: false },
				defaultValues: [true],
			});

			const result = await controller.getOptions({ keys: ["k"] });

			expect(result).toEqual({
				options: [
					{
						type: SystemConfigType.BOOLEAN,
						key: "k",
						supportsMultiple: false,
						values: [true],
					},
				],
			});
		});

		it("throws on an unknown config type", async () => {
			mockSystemConfigService.isRegistered.mockReturnValue(true);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "weird", supportsMultiple: false, value: [] },
			]);

			await expect(controller.getOptions({ keys: ["k"] })).rejects.toThrow(
				'Unknown config type "weird"',
			);
		});
	});

	describe("updateOptions()", () => {
		it("throws BadRequestException on duplicate keys", async () => {
			await expect(
				controller.updateOptions({
					options: [
						{ type: SystemConfigType.STRING, key: "k", values: ["a"] },
						{ type: SystemConfigType.STRING, key: "k", values: ["b"] },
					],
				}),
			).rejects.toThrow(new BadRequestException('Duplicate key "k"'));
			expect(mockSystemConfigService.updateOptions).not.toHaveBeenCalled();
		});

		it("updates the options and returns the mapped result", async () => {
			mockSystemConfigService.updateOptions.mockResolvedValue(undefined);
			mockSystemConfigService.getOptions.mockResolvedValue([
				{ key: "k", type: "boolean", supportsMultiple: false, value: [false] },
			]);
			mockSystemConfigService.getRegisteredOption.mockReturnValue({
				type: "boolean",
				options: { supportsMultiple: false },
				defaultValues: [true],
			});
			const dto = {
				options: [
					{ type: SystemConfigType.BOOLEAN, key: "k", values: [false] },
				],
			};

			const result = await controller.updateOptions(dto);

			expect(mockSystemConfigService.updateOptions).toHaveBeenCalledWith(
				dto.options,
			);
			expect(mockSystemConfigService.getOptions).toHaveBeenCalledWith(["k"]);
			expect(result).toEqual({
				options: [
					{
						type: SystemConfigType.BOOLEAN,
						key: "k",
						supportsMultiple: false,
						values: [false],
					},
				],
			});
		});
	});
});
