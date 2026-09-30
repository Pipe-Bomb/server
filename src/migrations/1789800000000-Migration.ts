import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789800000000 implements MigrationInterface {
	name = "Migration1789800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "saved_albums" ("albumUuid" uuid NOT NULL, "userUuid" uuid NOT NULL, "dateAdded" integer NOT NULL DEFAULT (unixepoch() * 1000), PRIMARY KEY ("albumUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_saved_albums_userUuid" ON "saved_albums" ("userUuid")`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_albums" ADD CONSTRAINT "FK_saved_albums_album" FOREIGN KEY ("albumUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_albums" ADD CONSTRAINT "FK_saved_albums_user" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`CREATE TABLE "saved_artists" ("artistUuid" uuid NOT NULL, "userUuid" uuid NOT NULL, "dateAdded" integer NOT NULL DEFAULT (unixepoch() * 1000), PRIMARY KEY ("artistUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_saved_artists_userUuid" ON "saved_artists" ("userUuid")`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_artists" ADD CONSTRAINT "FK_saved_artists_artist" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_artists" ADD CONSTRAINT "FK_saved_artists_user" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`CREATE TABLE "saved_tracks" ("trackUuid" uuid NOT NULL, "userUuid" uuid NOT NULL, "dateAdded" integer NOT NULL DEFAULT (unixepoch() * 1000), PRIMARY KEY ("trackUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_saved_tracks_userUuid" ON "saved_tracks" ("userUuid")`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_tracks" ADD CONSTRAINT "FK_saved_tracks_track" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "saved_tracks" ADD CONSTRAINT "FK_saved_tracks_user" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "saved_tracks"`);
		await queryRunner.query(`DROP TABLE "saved_artists"`);
		await queryRunner.query(`DROP TABLE "saved_albums"`);
	}
}
