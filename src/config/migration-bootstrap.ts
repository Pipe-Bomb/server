import { DataSource } from "typeorm";

const BASELINE_TIMESTAMP = 1788299287673;
const BASELINE_NAME = "InitialSchema1788299287673";

export async function runMigrationsWithLegacySupport(
	dataSource: DataSource,
): Promise<void> {
	const qr = dataSource.createQueryRunner();
	await qr.connect();

	try {
		const allTables: { name: string }[] = await qr.query(
			`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
		);

		const hasUserTable = allTables.some((r) => r.name === "users");
		const hasMigrationsTable = allTables.some((r) => r.name === "migrations");

		// Check whether the baseline migration has already been recorded.
		// We can't rely solely on the table existing — a previous failed run may
		// have created it but left it empty.
		let baselineApplied = false;
		if (hasMigrationsTable) {
			const rows = await qr.query(
				`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = '${BASELINE_NAME}'`,
			);
			baselineApplied = Number(rows[0].count) > 0;
		}

		if (hasUserTable && !baselineApplied) {
			// The schema was set up by synchronize but the baseline migration was never
			// recorded. Create the tracking table (if absent) and fake the baseline so
			// TypeORM won't try to re-create tables that already exist.
			await qr.query(
				`CREATE TABLE IF NOT EXISTS "migrations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)`,
			);
			await qr.query(
				`INSERT INTO "migrations" ("timestamp", "name") VALUES (${BASELINE_TIMESTAMP}, '${BASELINE_NAME}')`,
			);

			// Apply one-off schema fixups already incorporated into InitialSchema
			// (must not become regular migrations — that would break fresh installs).
			const hasOldSearchConfig = allTables.some(
				(r) => r.name === "search-config",
			);
			if (hasOldSearchConfig) {
				await qr.query(`ALTER TABLE "search-config" RENAME TO "search_config"`);
			}
		}
	} finally {
		await qr.release();
	}

	await dataSource.runMigrations();
}
