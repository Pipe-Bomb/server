import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1792819430505 implements MigrationInterface {
    name = 'Migration1792819430505'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
        await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
        await queryRunner.query(`CREATE TABLE "temporary_artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`);
        await queryRunner.query(`INSERT INTO "temporary_artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "artist_identities"`);
        await queryRunner.query(`DROP TABLE "artist_identities"`);
        await queryRunner.query(`ALTER TABLE "temporary_artist_identities" RENAME TO "artist_identities"`);
        await queryRunner.query(`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `);
        await queryRunner.query(`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `);
        await queryRunner.query(`CREATE TABLE "task-history" ("runId" varchar PRIMARY KEY NOT NULL, "pluginId" text NOT NULL, "taskId" text NOT NULL, "subTaskId" text, "result" text NOT NULL, "duration" integer NOT NULL, "dateStarted" integer NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_task_history_latest" ON "task-history" ("pluginId", "taskId", "dateStarted", "runId") `);
        await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
        await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
        await queryRunner.query(`CREATE TABLE "temporary_artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`);
        await queryRunner.query(`INSERT INTO "temporary_artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "artist_identities"`);
        await queryRunner.query(`DROP TABLE "artist_identities"`);
        await queryRunner.query(`ALTER TABLE "temporary_artist_identities" RENAME TO "artist_identities"`);
        await queryRunner.query(`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `);
        await queryRunner.query(`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `);
        await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
        await queryRunner.query(`CREATE TABLE "temporary_playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, "addedByPluginId" text, "addedByBotId" text, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`);
        await queryRunner.query(`INSERT INTO "temporary_playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId" FROM "playlist_tracks"`);
        await queryRunner.query(`DROP TABLE "playlist_tracks"`);
        await queryRunner.query(`ALTER TABLE "temporary_playlist_tracks" RENAME TO "playlist_tracks"`);
        await queryRunner.query(`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
        await queryRunner.query(`ALTER TABLE "playlist_tracks" RENAME TO "temporary_playlist_tracks"`);
        await queryRunner.query(`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, "addedByPluginId" text, "addedByBotId" text, CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`);
        await queryRunner.query(`INSERT INTO "playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid", "addedByPluginId", "addedByBotId" FROM "temporary_playlist_tracks"`);
        await queryRunner.query(`DROP TABLE "temporary_playlist_tracks"`);
        await queryRunner.query(`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `);
        await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
        await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
        await queryRunner.query(`ALTER TABLE "artist_identities" RENAME TO "temporary_artist_identities"`);
        await queryRunner.query(`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`);
        await queryRunner.query(`INSERT INTO "artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "temporary_artist_identities"`);
        await queryRunner.query(`DROP TABLE "temporary_artist_identities"`);
        await queryRunner.query(`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `);
        await queryRunner.query(`DROP INDEX "IDX_task_history_latest"`);
        await queryRunner.query(`DROP TABLE "task-history"`);
        await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
        await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
        await queryRunner.query(`ALTER TABLE "artist_identities" RENAME TO "temporary_artist_identities"`);
        await queryRunner.query(`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, "originalArtistUuid" varchar, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`);
        await queryRunner.query(`INSERT INTO "artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity", "originalArtistUuid" FROM "temporary_artist_identities"`);
        await queryRunner.query(`DROP TABLE "temporary_artist_identities"`);
        await queryRunner.query(`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `);
    }

}
