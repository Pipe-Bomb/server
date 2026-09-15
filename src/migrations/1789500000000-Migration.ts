import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789500000000 implements MigrationInterface {
	name = "Migration1789500000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "temporary_disabled_identifiers" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "type" text NOT NULL DEFAULT 'track', PRIMARY KEY ("pluginId", "identifierId", "type"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_disabled_identifiers" ("pluginId", "identifierId", "type") SELECT "pluginId", "identifierId", 'track' FROM "disabled_identifiers"`,
		);
		await queryRunner.query(`DROP TABLE "disabled_identifiers"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_disabled_identifiers" RENAME TO "disabled_identifiers"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "disabled_identifiers" RENAME TO "temporary_disabled_identifiers"`,
		);
		await queryRunner.query(
			`CREATE TABLE "disabled_identifiers" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "target" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "target"))`,
		);
		await queryRunner.query(
			`INSERT INTO "disabled_identifiers" ("pluginId", "identifierId", "target") SELECT "pluginId", "identifierId", "type" FROM "temporary_disabled_identifiers" WHERE "type" = 'track'`,
		);
		await queryRunner.query(`DROP TABLE "temporary_disabled_identifiers"`);
	}
}
