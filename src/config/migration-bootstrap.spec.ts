import { DataSource } from "typeorm";
import { runMigrationsWithLegacySupport } from "./migration-bootstrap";

describe("runMigrationsWithLegacySupport", () => {
	const queryRunner = {
		connect: jest.fn(),
		query: jest.fn<Promise<Record<string, unknown>[]>, [sql: string]>(),
		release: jest.fn(),
	};
	const createQueryRunner = jest.fn(() => queryRunner);
	const runMigrations = jest.fn();
	const dataSource = {
		createQueryRunner,
		runMigrations,
	} as unknown as DataSource;

	function executedStatements(): string[] {
		return queryRunner.query.mock.calls.map((call) => call[0]);
	}

	function hasStatement(statements: string[], needle: string): boolean {
		return statements.some((statement) => statement.includes(needle));
	}

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("runs migrations directly on a fresh database", async () => {
		queryRunner.query.mockResolvedValue([]);

		await runMigrationsWithLegacySupport(dataSource);

		expect(createQueryRunner).toHaveBeenCalledTimes(1);
		expect(queryRunner.connect).toHaveBeenCalledTimes(1);
		expect(queryRunner.query).toHaveBeenCalledTimes(1);
		expect(queryRunner.query).toHaveBeenCalledWith(
			expect.stringContaining("sqlite_master"),
		);
		expect(hasStatement(executedStatements(), "INSERT INTO")).toBe(false);
		expect(queryRunner.release).toHaveBeenCalledTimes(1);
		expect(runMigrations).toHaveBeenCalledTimes(1);
	});

	it("fakes the baseline and renames search-config on a legacy database", async () => {
		queryRunner.query.mockResolvedValue([
			{ name: "users" },
			{ name: "search-config" },
		]);

		await runMigrationsWithLegacySupport(dataSource);

		const statements = executedStatements();
		expect(
			hasStatement(statements, 'CREATE TABLE IF NOT EXISTS "migrations"'),
		).toBe(true);
		expect(hasStatement(statements, "1788299287673")).toBe(true);
		expect(hasStatement(statements, "InitialSchema1788299287673")).toBe(true);
		expect(statements).toContain(
			`ALTER TABLE "search-config" RENAME TO "search_config"`,
		);
		expect(runMigrations).toHaveBeenCalledTimes(1);
	});

	it("inserts the missing baseline row when the migrations table is empty", async () => {
		queryRunner.query
			.mockResolvedValueOnce([{ name: "migrations" }, { name: "users" }])
			.mockResolvedValueOnce([{ count: 0 }]);

		await runMigrationsWithLegacySupport(dataSource);

		const statements = executedStatements();
		expect(
			hasStatement(statements, 'CREATE TABLE IF NOT EXISTS "migrations"'),
		).toBe(true);
		expect(
			hasStatement(
				statements,
				'INSERT INTO "migrations" ("timestamp", "name") VALUES (1788299287673, \'InitialSchema1788299287673\')',
			),
		).toBe(true);
		expect(hasStatement(statements, "RENAME TO")).toBe(false);
		expect(runMigrations).toHaveBeenCalledTimes(1);
	});

	it("skips the baseline insert when it is already recorded", async () => {
		queryRunner.query
			.mockResolvedValueOnce([{ name: "migrations" }, { name: "users" }])
			.mockResolvedValueOnce([{ count: 1 }]);

		await runMigrationsWithLegacySupport(dataSource);

		const statements = executedStatements();
		expect(statements).toHaveLength(2);
		expect(hasStatement(statements, "INSERT INTO")).toBe(false);
		expect(hasStatement(statements, "CREATE TABLE")).toBe(false);
		expect(runMigrations).toHaveBeenCalledTimes(1);
	});

	it("releases the query runner and skips runMigrations on failure", async () => {
		queryRunner.query.mockRejectedValue(new Error("db exploded"));

		await expect(runMigrationsWithLegacySupport(dataSource)).rejects.toThrow(
			"db exploded",
		);
		expect(queryRunner.release).toHaveBeenCalledTimes(1);
		expect(runMigrations).not.toHaveBeenCalled();
	});
});
