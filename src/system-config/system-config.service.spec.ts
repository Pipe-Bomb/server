import { BadRequestException, Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InvalidSystemConfigValueError } from "./error/invalid-system-config-value.error";
import { DBSystemConfig } from "./entity/system-config.entity";
import { SystemConfigType } from "./enum/system-config-type.enum";
import { SystemConfigService } from "./system-config.service";

const mockRepo = {
	find: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
	insert: jest.fn<Promise<unknown>, [entities: DBSystemConfig[]]>(),
};

function configEntry(overrides: Partial<DBSystemConfig> = {}): DBSystemConfig {
	return {
		key: "key",
		ordinal: 0,
		value_string: null,
		value_int: null,
		value_decimal: null,
		value_boolean: null,
		...overrides,
	} as DBSystemConfig;
}

describe("SystemConfigService", () => {
	let service: SystemConfigService;
	let warnSpy: jest.SpyInstance;

	beforeEach(async () => {
		jest.clearAllMocks();
		warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SystemConfigService,
				{ provide: getRepositoryToken(DBSystemConfig), useValue: mockRepo },
			],
		}).compile();
		service = module.get(SystemConfigService);
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	describe("registerOption()", () => {
		it("registers an option with its default values", () => {
			service.registerOption(
				"foo",
				"string",
				{ supportsMultiple: false },
				"d1",
				"d2",
			);

			expect(service.isRegistered("foo")).toBe(true);
			expect(service.getRegisteredOption("foo")).toEqual({
				type: "string",
				options: { supportsMultiple: false },
				defaultValues: ["d1", "d2"],
			});
		});

		it("throws when the key has already been registered", () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			expect(() =>
				service.registerOption(
					"foo",
					"string",
					{ supportsMultiple: false },
					"d",
				),
			).toThrow('System Config option "foo" has already been registered');
		});
	});

	describe("getOption()", () => {
		it("throws when the option is not registered", async () => {
			await expect(service.getOption("nope", "string")).rejects.toThrow(
				'System Config option "nope" is not registered',
			);
		});

		it("throws when the requested type does not match", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(service.getOption("foo", "integer")).rejects.toThrow(
				'System Config option "foo" is type "string"',
			);
		});

		it("returns the value stored in the database", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");
			mockRepo.find.mockResolvedValue([
				configEntry({ value_string: "from-db" }),
			]);

			const value = await service.getOption("foo", "string");

			expect(mockRepo.find).toHaveBeenCalledWith({
				where: { key: "foo" },
				order: { ordinal: "asc" },
			});
			expect(value).toBe("from-db");
		});

		it("falls back to the default value when the database is empty", async () => {
			service.registerOption("foo", "integer", { supportsMultiple: false }, 7);
			mockRepo.find.mockResolvedValue([]);

			expect(await service.getOption("foo", "integer")).toBe(7);
			expect(warnSpy).not.toHaveBeenCalled();
		});

		it("falls back to the default and warns when rows exist but are mistyped", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");
			mockRepo.find.mockResolvedValue([configEntry({ value_string: null })]);

			expect(await service.getOption("foo", "string")).toBe("d");
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'System Config option "foo" is incorrectly typed',
				),
			);
		});

		it("returns an array of all values when supportMultiple is true", async () => {
			service.registerOption(
				"foo",
				"integer",
				{ supportsMultiple: true },
				1,
				2,
			);
			mockRepo.find.mockResolvedValue([
				configEntry({ ordinal: 0, value_int: 5 }),
				configEntry({ ordinal: 1, value_int: 6 }),
			]);

			expect(await service.getOption("foo", "integer", true)).toEqual([5, 6]);
		});
	});

	describe("getOptions()", () => {
		it("returns an empty list for no keys", async () => {
			expect(await service.getOptions([])).toEqual([]);
			expect(mockRepo.find).not.toHaveBeenCalled();
		});

		it("throws when any key is not registered", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(service.getOptions(["foo", "nope"])).rejects.toThrow(
				'System Config option "nope" is not registered',
			);
		});

		it("groups values by key and honours supportsMultiple", async () => {
			service.registerOption(
				"single",
				"string",
				{ supportsMultiple: false },
				"d",
			);
			service.registerOption("multi", "integer", { supportsMultiple: true }, 1);
			mockRepo.find.mockResolvedValue([
				configEntry({ key: "single", value_string: "s1" }),
				configEntry({ key: "multi", ordinal: 0, value_int: 2 }),
				configEntry({ key: "multi", ordinal: 1, value_int: 3 }),
			]);

			expect(await service.getOptions(["single", "multi"])).toEqual([
				{
					key: "single",
					type: "string",
					supportsMultiple: false,
					value: ["s1"],
				},
				{
					key: "multi",
					type: "integer",
					supportsMultiple: true,
					value: [2, 3],
				},
			]);
		});

		it("falls back to defaults for keys with no rows", async () => {
			service.registerOption(
				"foo",
				"boolean",
				{ supportsMultiple: false },
				true,
			);
			mockRepo.find.mockResolvedValue([]);

			expect(await service.getOptions(["foo"])).toEqual([
				{
					key: "foo",
					type: "boolean",
					supportsMultiple: false,
					value: [true],
				},
			]);
		});
	});

	describe("setOption()", () => {
		it("throws when the option is not registered", async () => {
			await expect(service.setOption("nope", "string", "v")).rejects.toThrow(
				'System Config option "nope" is not registered',
			);
		});

		it("throws when the type does not match", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(service.setOption("foo", "integer", 1)).rejects.toThrow(
				'System Config option "foo" is type "string"',
			);
		});

		it("throws when multiple values are given for a single-value option", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(
				service.setOption("foo", "string", ["a", "b"]),
			).rejects.toThrow(
				'System Config option "foo" does not support multiple values',
			);
		});

		it("rejects non-string values for string options", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(
				service.setOption("foo", "string", 42 as never),
			).rejects.toMatchObject({
				key: "foo",
				message: 'Option must be type "string"',
			});
		});

		it("rejects strings shorter than minLength", async () => {
			service.registerOption(
				"foo",
				"string",
				{ supportsMultiple: false, minLength: 3 },
				"d",
			);

			await expect(service.setOption("foo", "string", "ab")).rejects.toThrow(
				"Option must not be shorter than 3 characters",
			);
		});

		it("rejects strings longer than maxLength", async () => {
			service.registerOption(
				"foo",
				"string",
				{ supportsMultiple: false, maxLength: 2 },
				"d",
			);

			await expect(service.setOption("foo", "string", "abc")).rejects.toThrow(
				"Option must not be longer than 2 characters",
			);
		});

		it("applies the string transform before persisting", async () => {
			service.registerOption(
				"foo",
				"string",
				{
					supportsMultiple: false,
					transform: (value) => value.toUpperCase(),
				},
				"d",
			);
			mockRepo.create.mockImplementation((data: object) => data);

			await service.setOption("foo", "string", "abc");

			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ value_string: "ABC" }),
			);
		});

		it("rejects non-integer values for integer options", async () => {
			service.registerOption("foo", "integer", { supportsMultiple: false }, 1);

			await expect(service.setOption("foo", "integer", 1.5)).rejects.toThrow(
				'Option must be type "integer"',
			);
			await expect(
				service.setOption("foo", "integer", "x" as never),
			).rejects.toThrow('Option must be type "integer"');
		});

		it("rejects numbers below min", async () => {
			service.registerOption(
				"foo",
				"integer",
				{ supportsMultiple: false, min: 1 },
				1,
			);

			await expect(service.setOption("foo", "integer", 0)).rejects.toThrow(
				"Option must not be less than 1",
			);
		});

		it("rejects numbers above max (message reports min — see escalation)", async () => {
			service.registerOption(
				"foo",
				"integer",
				{ supportsMultiple: false, min: 1, max: 10 },
				1,
			);

			await expect(service.setOption("foo", "integer", 11)).rejects.toThrow(
				new InvalidSystemConfigValueError(
					"foo",
					"Option must not be greater than 1",
				),
			);
		});

		it("rejects decimal values outside the min/max range", async () => {
			service.registerOption(
				"foo",
				"decimal",
				{ supportsMultiple: false, min: 0, max: 1 },
				0.5,
			);

			await expect(service.setOption("foo", "decimal", -1)).rejects.toThrow(
				"Option must not be less than 0",
			);
			await expect(service.setOption("foo", "decimal", 2)).rejects.toThrow(
				"Option must not be greater than 0",
			);
		});

		it("rejects non-boolean values for boolean options", async () => {
			service.registerOption(
				"foo",
				"boolean",
				{ supportsMultiple: false },
				true,
			);

			await expect(
				service.setOption("foo", "boolean", "yes" as never),
			).rejects.toMatchObject({
				key: "foo",
				message: 'Option must be type "boolean"',
			});
		});

		it("replaces existing rows with the new value", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");
			mockRepo.create.mockImplementation((data: object) => data);

			await service.setOption("foo", "string", "v");

			expect(mockRepo.create).toHaveBeenCalledWith({
				key: "foo",
				ordinal: 0,
				value_boolean: null,
				value_int: null,
				value_string: "v",
				value_decimal: null,
			});
			expect(mockRepo.delete).toHaveBeenCalledWith({ key: "foo" });
			expect(mockRepo.insert).toHaveBeenCalledWith([
				expect.objectContaining({ value_string: "v" }),
			]);
		});

		it("persists every value with its ordinal for multi-value options", async () => {
			service.registerOption("foo", "integer", { supportsMultiple: true }, 1);
			mockRepo.create.mockImplementation((data: object) => data);

			await service.setOption("foo", "integer", [1, 2]);

			expect(mockRepo.create).toHaveBeenNthCalledWith(1, {
				key: "foo",
				ordinal: 0,
				value_boolean: null,
				value_int: 1,
				value_string: null,
				value_decimal: null,
			});
			expect(mockRepo.create).toHaveBeenNthCalledWith(2, {
				key: "foo",
				ordinal: 1,
				value_boolean: null,
				value_int: 2,
				value_string: null,
				value_decimal: null,
			});
			expect(mockRepo.insert).toHaveBeenCalledTimes(1);
			expect(mockRepo.insert.mock.calls[0][0]).toHaveLength(2);
		});
	});

	describe("deleteOption()", () => {
		it("throws when the option is not registered", async () => {
			await expect(service.deleteOption("nope")).rejects.toThrow(
				'System Config option "nope" is not registered',
			);
		});

		it("deletes all rows for the key", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await service.deleteOption("foo");

			expect(mockRepo.delete).toHaveBeenCalledWith({ key: "foo" });
		});
	});

	describe("isRegistered() / getRegisteredOption()", () => {
		it("reports unknown keys as unregistered", () => {
			expect(service.isRegistered("nope")).toBe(false);
			expect(service.getRegisteredOption("nope")).toBeUndefined();
		});
	});

	describe("updateOptions()", () => {
		it("throws BadRequestException for unregistered keys", async () => {
			await expect(
				service.updateOptions([
					{ type: SystemConfigType.STRING, key: "nope", values: ["a"] },
				]),
			).rejects.toThrow(
				new BadRequestException('Option "nope" is not registered'),
			);
		});

		it("throws BadRequestException for a type mismatch", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(
				service.updateOptions([
					{ type: SystemConfigType.INTEGER, key: "foo", values: [1] },
				]),
			).rejects.toThrow(
				new BadRequestException('Option "foo" is type "string"'),
			);
		});

		it("throws BadRequestException for multiple values on a single-value option", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");

			await expect(
				service.updateOptions([
					{ type: SystemConfigType.STRING, key: "foo", values: ["a", "b"] },
				]),
			).rejects.toThrow(
				new BadRequestException(
					'Option "foo" doesn\'t support multiple values',
				),
			);
		});

		it("throws BadRequestException for strings violating min/max length", async () => {
			service.registerOption(
				"foo",
				"string",
				{
					supportsMultiple: false,
					minLength: 3,
					maxLength: 4,
				},
				"d",
			);

			await expect(
				service.updateOptions([
					{ type: SystemConfigType.STRING, key: "foo", values: ["ab"] },
				]),
			).rejects.toThrow(
				new BadRequestException(
					'Option "foo" must not be shorter than 3 chars',
				),
			);
			await expect(
				service.updateOptions([
					{ type: SystemConfigType.STRING, key: "foo", values: ["abcde"] },
				]),
			).rejects.toThrow(
				new BadRequestException('Option "foo" must not be longer than 4 chars'),
			);
		});

		it("throws BadRequestException for numbers outside min/max", async () => {
			service.registerOption(
				"foo",
				"integer",
				{ supportsMultiple: false, min: 1, max: 5 },
				1,
			);

			await expect(
				service.updateOptions([
					{ type: SystemConfigType.INTEGER, key: "foo", values: [0] },
				]),
			).rejects.toThrow(
				new BadRequestException('Option "foo" must not be less than 1'),
			);
			await expect(
				service.updateOptions([
					{ type: SystemConfigType.INTEGER, key: "foo", values: [6] },
				]),
			).rejects.toThrow(
				new BadRequestException('Option "foo" must not be greater than 5'),
			);
		});

		it("delegates to setOption with a single value", async () => {
			service.registerOption("foo", "string", { supportsMultiple: false }, "d");
			mockRepo.create.mockImplementation((data: object) => data);

			await service.updateOptions([
				{ type: SystemConfigType.STRING, key: "foo", values: ["v"] },
			]);

			expect(mockRepo.delete).toHaveBeenCalledWith({ key: "foo" });
			expect(mockRepo.insert).toHaveBeenCalledWith([
				expect.objectContaining({ value_string: "v" }),
			]);
		});

		it("delegates to setOption with the full value array for multi-value options", async () => {
			service.registerOption("foo", "integer", { supportsMultiple: true }, 1);
			mockRepo.create.mockImplementation((data: object) => data);

			await service.updateOptions([
				{ type: SystemConfigType.INTEGER, key: "foo", values: [1, 2] },
			]);

			expect(mockRepo.insert).toHaveBeenCalledTimes(1);
			expect(mockRepo.insert.mock.calls[0][0]).toHaveLength(2);
		});
	});
});
