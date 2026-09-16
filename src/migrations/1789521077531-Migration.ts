import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1789521077531 implements MigrationInterface {
	name = "Migration1789521077531";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "artist_identities"`,
		);
		await queryRunner.query(`DROP TABLE "artist_identities"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_artist_identities" RENAME TO "artist_identities"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE TABLE "playback_history_entries" ("uuid" varchar PRIMARY KEY NOT NULL, "trackUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "datePlayed" integer NOT NULL, "dateRecorded" integer NOT NULL DEFAULT (datetime('now')), "pluginId" text, "clientName" text NOT NULL, CONSTRAINT "UQ_c22f3fa7593da54bf3f2ece311d" UNIQUE ("trackUuid", "userUuid", "datePlayed", "pluginId", "clientName"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_46698159324d27c7f291d9cbc5" ON "playback_history_entries" ("userUuid", "datePlayed") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "artist_identities"`,
		);
		await queryRunner.query(`DROP TABLE "artist_identities"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_artist_identities" RENAME TO "artist_identities"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_disabled_identifiers" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "type" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "type"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_disabled_identifiers"("pluginId", "identifierId", "type") SELECT "pluginId", "identifierId", "type" FROM "disabled_identifiers"`,
		);
		await queryRunner.query(`DROP TABLE "disabled_identifiers"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_disabled_identifiers" RENAME TO "disabled_identifiers"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid" FROM "playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "playlist_tracks"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playlist_tracks" RENAME TO "playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_46698159324d27c7f291d9cbc5"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playback_history_entries" ("uuid" varchar PRIMARY KEY NOT NULL, "trackUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "datePlayed" integer NOT NULL, "dateRecorded" integer NOT NULL DEFAULT (datetime('now')), "pluginId" text, "clientName" text NOT NULL, CONSTRAINT "UQ_c22f3fa7593da54bf3f2ece311d" UNIQUE ("trackUuid", "userUuid", "datePlayed", "pluginId", "clientName"), CONSTRAINT "FK_ce832704e6d3cc5652d03395a99" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e41be45bae2d9cc7f6c0813bbec" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playback_history_entries"("uuid", "trackUuid", "userUuid", "datePlayed", "dateRecorded", "pluginId", "clientName") SELECT "uuid", "trackUuid", "userUuid", "datePlayed", "dateRecorded", "pluginId", "clientName" FROM "playback_history_entries"`,
		);
		await queryRunner.query(`DROP TABLE "playback_history_entries"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playback_history_entries" RENAME TO "playback_history_entries"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_46698159324d27c7f291d9cbc5" ON "playback_history_entries" ("userUuid", "datePlayed") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_46698159324d27c7f291d9cbc5"`);
		await queryRunner.query(
			`ALTER TABLE "playback_history_entries" RENAME TO "temporary_playback_history_entries"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playback_history_entries" ("uuid" varchar PRIMARY KEY NOT NULL, "trackUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "datePlayed" integer NOT NULL, "dateRecorded" integer NOT NULL DEFAULT (datetime('now')), "pluginId" text, "clientName" text NOT NULL, CONSTRAINT "UQ_c22f3fa7593da54bf3f2ece311d" UNIQUE ("trackUuid", "userUuid", "datePlayed", "pluginId", "clientName"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playback_history_entries"("uuid", "trackUuid", "userUuid", "datePlayed", "dateRecorded", "pluginId", "clientName") SELECT "uuid", "trackUuid", "userUuid", "datePlayed", "dateRecorded", "pluginId", "clientName" FROM "temporary_playback_history_entries"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playback_history_entries"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_46698159324d27c7f291d9cbc5" ON "playback_history_entries" ("userUuid", "datePlayed") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_tracks" RENAME TO "temporary_playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid" FROM "temporary_playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_tracks"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(
			`ALTER TABLE "disabled_identifiers" RENAME TO "temporary_disabled_identifiers"`,
		);
		await queryRunner.query(
			`CREATE TABLE "disabled_identifiers" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "type" text NOT NULL DEFAULT ('track'), PRIMARY KEY ("pluginId", "identifierId", "type"))`,
		);
		await queryRunner.query(
			`INSERT INTO "disabled_identifiers"("pluginId", "identifierId", "type") SELECT "pluginId", "identifierId", "type" FROM "temporary_disabled_identifiers"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_disabled_identifiers"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(
			`ALTER TABLE "artist_identities" RENAME TO "temporary_artist_identities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "temporary_artist_identities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_artist_identities"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_46698159324d27c7f291d9cbc5"`);
		await queryRunner.query(`DROP TABLE "playback_history_entries"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(
			`ALTER TABLE "artist_identities" RENAME TO "temporary_artist_identities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "temporary_artist_identities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_artist_identities"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
	}
}
