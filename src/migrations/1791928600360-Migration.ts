import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1791928600360 implements MigrationInterface {
	name = "Migration1791928600360";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
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
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, "addedByPluginId" text, "addedByBotId" text, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
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
		await queryRunner.query(`DROP INDEX "IDX_b9fea870d77acc569bf6c27aff"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlists" ("uuid" varchar PRIMARY KEY NOT NULL, "ownerUuid" varchar, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "dateModified" integer NOT NULL DEFAULT (datetime('now')), "visibility" varchar CHECK( "visibility" IN ('public','unlisted','private') ) NOT NULL DEFAULT ('public'), "lastSmartFilterScanRunId" varchar, "ownerPluginId" text, "ownerBotId" text, CONSTRAINT "FK_af982774e98519f4d03e7c05b79" FOREIGN KEY ("ownerUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playlists"("uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId") SELECT "uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId" FROM "playlists"`,
		);
		await queryRunner.query(`DROP TABLE "playlists"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playlists" RENAME TO "playlists"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9fea870d77acc569bf6c27aff" ON "playlists" ("lastSmartFilterScanRunId") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
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
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, "addedByPluginId" text, "addedByBotId" text, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId" FROM "playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "playlist_tracks"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playlist_tracks" RENAME TO "playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_tracks" RENAME TO "temporary_playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, "addedByPluginId" text, "addedByBotId" text, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId" FROM "temporary_playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_tracks"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
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
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_b9fea870d77acc569bf6c27aff"`);
		await queryRunner.query(
			`ALTER TABLE "playlists" RENAME TO "temporary_playlists"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlists" ("uuid" varchar PRIMARY KEY NOT NULL, "ownerUuid" varchar, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "dateModified" integer NOT NULL DEFAULT (datetime('now')), "visibility" varchar CHECK( "visibility" IN ('public','unlisted','private') ) NOT NULL DEFAULT ('public'), "lastSmartFilterScanRunId" varchar, CONSTRAINT "FK_af982774e98519f4d03e7c05b79" FOREIGN KEY ("ownerUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "playlists"("uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId") SELECT "uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId" FROM "temporary_playlists"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlists"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9fea870d77acc569bf6c27aff" ON "playlists" ("lastSmartFilterScanRunId") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_tracks" RENAME TO "temporary_playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid" FROM "temporary_playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_tracks"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
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
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
	}
}
