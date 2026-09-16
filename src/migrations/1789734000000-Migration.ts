import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789734000000 implements MigrationInterface {
	name = "Migration1789734000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "playback_history_entries" SET "datePlayed" = "datePlayed" * 1000`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "playback_history_entries" SET "datePlayed" = "datePlayed" / 1000`,
		);
	}
}
