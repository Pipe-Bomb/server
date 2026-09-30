import { Database } from "better-sqlite3";
import databaseConfig from "./database.config";

const ENV_KEYS = [
	"DB_TYPE",
	"DB_HOST",
	"DB_PORT",
	"DB_USER",
	"DB_PASS",
	"DB_NAME",
	"DB_FILE",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function buildOptions(): Record<string, unknown> {
	// registerAs (in this @nestjs/config version) returns the factory itself
	return databaseConfig() as unknown as Record<string, unknown>;
}

describe("database.config", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		for (const key of ENV_KEYS) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
	});

	it("builds postgres options from the environment", () => {
		process.env.DB_TYPE = "postgres";
		process.env.DB_HOST = "db-host";
		process.env.DB_PORT = "5433";
		process.env.DB_USER = "db-user";
		process.env.DB_PASS = "db-pass";
		process.env.DB_NAME = "db-name";

		const options = buildOptions();

		expect(options).toMatchObject({
			type: "postgres",
			host: "db-host",
			port: 5433,
			username: "db-user",
			password: "db-pass",
			database: "db-name",
			synchronize: false,
			migrationsRun: false,
		});
	});

	it("defaults the postgres port to 5432 when DB_PORT is unset", () => {
		process.env.DB_TYPE = "postgres";

		const options = buildOptions();

		expect(options.type).toBe("postgres");
		expect(options.port).toBe(5432);
	});

	it("builds better-sqlite3 options with the default database file", () => {
		const options = buildOptions();

		expect(options).toMatchObject({
			type: "better-sqlite3",
			database: "dev.sqlite",
			enableWAL: true,
			synchronize: false,
			migrationsRun: false,
		});
	});

	it("uses DB_FILE as the database path when set", () => {
		process.env.DB_FILE = "/var/lib/pb/prod.sqlite";

		const options = buildOptions();

		expect(options.type).toBe("better-sqlite3");
		expect(options.database).toBe("/var/lib/pb/prod.sqlite");
	});

	it("configures sqlite pragmas in prepareDatabase", () => {
		const options = buildOptions();
		const pragma = jest.fn();
		const db = { pragma } as unknown as Database;

		(options.prepareDatabase as (db: Database) => void)(db);

		expect(pragma).toHaveBeenCalledTimes(4);
		expect(pragma).toHaveBeenNthCalledWith(1, "synchronous = NORMAL");
		expect(pragma).toHaveBeenNthCalledWith(2, "temp_store = MEMORY");
		expect(pragma).toHaveBeenNthCalledWith(3, "cache_size = -524288");
		expect(pragma).toHaveBeenNthCalledWith(4, "mmap_size = 1073741824");
	});
});
