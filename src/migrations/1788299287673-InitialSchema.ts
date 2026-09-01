import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788299287673 implements MigrationInterface {
	name = "InitialSchema1788299287673";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "workflow_step_option_values" ("optionId" text NOT NULL, "stepUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, PRIMARY KEY ("optionId", "stepUuid"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "workflow_steps" ("uuid" varchar PRIMARY KEY NOT NULL, "workflowUuid" varchar NOT NULL, "stepType" varchar CHECK( "stepType" IN ('trigger','step') ) NOT NULL, "previousStepUuid" varchar, "pluginId" text, "stepId" text, CONSTRAINT "REL_395aa65c53bf7ea6fa338a8554" UNIQUE ("previousStepUuid"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "workflows" ("uuid" varchar PRIMARY KEY NOT NULL, "name" text NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')))`,
		);
		await queryRunner.query(
			`CREATE TABLE "resources" ("uuid" varchar PRIMARY KEY NOT NULL, "sha256" text NOT NULL, "extension" text NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d53189ffb31b08f5b42f85f199" ON "playlist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "track_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c3a2855975b65a51bed0c8140" ON "track_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "trackUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "trackUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc80f875cbf2a9d8689dde7e31" ON "identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fe7cc12d56511236176a302d28" ON "identities" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32e3a95788779780afdaebbe8b" ON "artist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "album_tracks" ("albumUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "discNumber" integer NOT NULL DEFAULT (1), "trackNumber" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, PRIMARY KEY ("albumUuid", "trackUuid", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7613147c00e13bfe5476a126ab" ON "album_tracks" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac7fac9bbe236386b632f6910c" ON "album_tracks" ("albumUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "album_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "albumUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "albumUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_714972683099919bed8df37ae5" ON "album_identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE TABLE "album_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5d1637eeebcc4d11f01202b709" ON "album_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "albums" ("uuid" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "lastIdentificationRunId" varchar, "lastAttributionRunId" varchar)`,
		);
		await queryRunner.query(
			`CREATE TABLE "album_artists" ("albumUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, PRIMARY KEY ("albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a09cba87ccc7f63eceb969df7f" ON "album_artists" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fc6d92000fb77e380f2a8e666" ON "album_artists" ("albumUuid") `,
		);
		await queryRunner.query(
			`CREATE TABLE "artists" ("uuid" varchar PRIMARY KEY NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "lastIdentificationRunId" varchar, "lastAttributionRunId" varchar)`,
		);
		await queryRunner.query(
			`CREATE TABLE "track_artists" ("trackUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, PRIMARY KEY ("trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f679419f9dc3dbe91a592cfa5" ON "track_artists" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a0b683aa55b18737aa2965670" ON "track_artists" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_74b40bd07523b3b2fa6348b0af" ON "track_artists" ("trackUuid", "artistUuid", "pluginId", "identifierId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "tracks" ("uuid" varchar PRIMARY KEY NOT NULL, "pluginId" text NOT NULL, "libraryId" text NOT NULL, "trackId" text NOT NULL, "title" text NOT NULL, "lastScanRunId" varchar, "lastIdentificationRunId" varchar, "lastAttributionRunId" varchar, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "IDX_pluginId_libraryId_trackId" UNIQUE ("pluginId", "libraryId", "trackId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_members" ("playlistUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "role" varchar CHECK( "role" IN ('collaborator','viewer') ) NOT NULL DEFAULT ('viewer'), "dateAdded" integer NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("playlistUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "smart_playlist_filters" ("uuid" varchar PRIMARY KEY NOT NULL, "groupUuid" varchar NOT NULL, "entityType" varchar CHECK( "entityType" IN ('track','artist','album') ) NOT NULL, "attributeKey" text NOT NULL, "attributeType" varchar CHECK( "attributeType" IN ('string','integer','decimal','boolean','buffer') ) NOT NULL, "value_boolean" boolean, "value_string" text, "value_int" integer, "value_decimal" double precision, "inverse" boolean NOT NULL DEFAULT (0), "min" double precision, "max" double precision, "partial" boolean)`,
		);
		await queryRunner.query(
			`CREATE TABLE "smart_playlist_filter_groups" ("uuid" varchar PRIMARY KEY NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "playlistUuid" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlists" ("uuid" varchar PRIMARY KEY NOT NULL, "ownerUuid" varchar, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "dateModified" integer NOT NULL DEFAULT (datetime('now')), "visibility" varchar CHECK( "visibility" IN ('public','unlisted','private') ) NOT NULL DEFAULT ('public'), "lastSmartFilterScanRunId" varchar)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9fea870d77acc569bf6c27aff" ON "playlists" ("lastSmartFilterScanRunId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "privilege" ("userUuid" varchar NOT NULL, "privilegeKey" text NOT NULL, "pluginId" text NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "IDX_userUuid_privilegeKey_pluginId" UNIQUE ("userUuid", "privilegeKey"), PRIMARY KEY ("userUuid", "privilegeKey", "pluginId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "users" ("uuid" varchar PRIMARY KEY NOT NULL, "username" text NOT NULL, "passwordHash" text NOT NULL, "passwordSalt" text NOT NULL, "isOwner" boolean NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `,
		);
		await queryRunner.query(
			`CREATE TABLE "resumable-task-progress" ("pluginId" text NOT NULL, "taskId" text NOT NULL, "runId" varchar NOT NULL, "subTaskId" text, "progress" double precision NOT NULL, PRIMARY KEY ("pluginId", "taskId", "runId"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_4e52fe0160c4d359149cff5ef8" ON "resumable-task-progress" ("runId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "search_config" ("id" integer PRIMARY KEY NOT NULL, "activePluginId" text, "activeSourceId" text)`,
		);
		await queryRunner.query(
			`CREATE TABLE "system-config" ("key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "user_config_entries" ("pluginId" text NOT NULL, "configId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "userUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, PRIMARY KEY ("pluginId", "configId", "key", "ordinal", "userUuid"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "config_entries" ("pluginId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, PRIMARY KEY ("pluginId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "marketplaces" ("uuid" varchar PRIMARY KEY NOT NULL, "url" text NOT NULL, "name" text, "addedAt" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_3cca19e50ef6db1519f9969a959" UNIQUE ("url"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_workflow_step_option_values" ("optionId" text NOT NULL, "stepUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, CONSTRAINT "FK_b7b53e37f722c740cab941ec142" FOREIGN KEY ("stepUuid") REFERENCES "workflow_steps" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("optionId", "stepUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_workflow_step_option_values"("optionId", "stepUuid", "value_string", "value_int", "value_decimal", "value_boolean") SELECT "optionId", "stepUuid", "value_string", "value_int", "value_decimal", "value_boolean" FROM "workflow_step_option_values"`,
		);
		await queryRunner.query(`DROP TABLE "workflow_step_option_values"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_workflow_step_option_values" RENAME TO "workflow_step_option_values"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_workflow_steps" ("uuid" varchar PRIMARY KEY NOT NULL, "workflowUuid" varchar NOT NULL, "stepType" varchar CHECK( "stepType" IN ('trigger','step') ) NOT NULL, "previousStepUuid" varchar, "pluginId" text, "stepId" text, CONSTRAINT "REL_395aa65c53bf7ea6fa338a8554" UNIQUE ("previousStepUuid"), CONSTRAINT "FK_1adb511ce92fcc222d7902f35f1" FOREIGN KEY ("workflowUuid") REFERENCES "workflows" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_395aa65c53bf7ea6fa338a85544" FOREIGN KEY ("previousStepUuid") REFERENCES "workflow_steps" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_workflow_steps"("uuid", "workflowUuid", "stepType", "previousStepUuid", "pluginId", "stepId") SELECT "uuid", "workflowUuid", "stepType", "previousStepUuid", "pluginId", "stepId" FROM "workflow_steps"`,
		);
		await queryRunner.query(`DROP TABLE "workflow_steps"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_workflow_steps" RENAME TO "workflow_steps"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_d53189ffb31b08f5b42f85f199"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, CONSTRAINT "FK_417020f6dcd7f6b1fc35ac3eba2" FOREIGN KEY ("valueBufferUuid") REFERENCES "resources" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d53189ffb31b08f5b42f85f1996" FOREIGN KEY ("entityRelationIdUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playlist_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "playlist_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "playlist_attributes"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playlist_attributes" RENAME TO "playlist_attributes"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d53189ffb31b08f5b42f85f199" ON "playlist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_1c3a2855975b65a51bed0c8140"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_track_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, CONSTRAINT "FK_a8ac2ae6b9a02a6d63ebc6e56c6" FOREIGN KEY ("valueBufferUuid") REFERENCES "resources" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c3a2855975b65a51bed0c81408" FOREIGN KEY ("entityRelationIdUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_track_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "track_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "track_attributes"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_track_attributes" RENAME TO "track_attributes"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c3a2855975b65a51bed0c8140" ON "track_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_bc80f875cbf2a9d8689dde7e31"`);
		await queryRunner.query(`DROP INDEX "IDX_fe7cc12d56511236176a302d28"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "trackUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, CONSTRAINT "FK_fe7cc12d56511236176a302d28e" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "trackUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_identities"("pluginId", "identifierId", "trackUuid", "ordinal", "identity") SELECT "pluginId", "identifierId", "trackUuid", "ordinal", "identity" FROM "identities"`,
		);
		await queryRunner.query(`DROP TABLE "identities"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_identities" RENAME TO "identities"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc80f875cbf2a9d8689dde7e31" ON "identities" ("identity") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fe7cc12d56511236176a302d28" ON "identities" ("trackUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, CONSTRAINT "FK_868ef056b20d0fe1e1a25d506a6" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity" FROM "artist_identities"`,
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
		await queryRunner.query(`DROP INDEX "IDX_32e3a95788779780afdaebbe8b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_artist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, CONSTRAINT "FK_aa3f1faef4b60b5190966a8da90" FOREIGN KEY ("valueBufferUuid") REFERENCES "resources" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_32e3a95788779780afdaebbe8bc" FOREIGN KEY ("entityRelationIdUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_artist_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "artist_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "artist_attributes"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_artist_attributes" RENAME TO "artist_attributes"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32e3a95788779780afdaebbe8b" ON "artist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_7613147c00e13bfe5476a126ab"`);
		await queryRunner.query(`DROP INDEX "IDX_ac7fac9bbe236386b632f6910c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_album_tracks" ("albumUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "discNumber" integer NOT NULL DEFAULT (1), "trackNumber" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, CONSTRAINT "FK_ac7fac9bbe236386b632f6910cc" FOREIGN KEY ("albumUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7613147c00e13bfe5476a126ab8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("albumUuid", "trackUuid", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_album_tracks"("albumUuid", "trackUuid", "discNumber", "trackNumber", "pluginId", "identifierId") SELECT "albumUuid", "trackUuid", "discNumber", "trackNumber", "pluginId", "identifierId" FROM "album_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "album_tracks"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_album_tracks" RENAME TO "album_tracks"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7613147c00e13bfe5476a126ab" ON "album_tracks" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac7fac9bbe236386b632f6910c" ON "album_tracks" ("albumUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_714972683099919bed8df37ae5"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_album_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "albumUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, CONSTRAINT "FK_48382c8671be4e5891f44ec0634" FOREIGN KEY ("albumUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "identifierId", "albumUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_album_identities"("pluginId", "identifierId", "albumUuid", "ordinal", "identity") SELECT "pluginId", "identifierId", "albumUuid", "ordinal", "identity" FROM "album_identities"`,
		);
		await queryRunner.query(`DROP TABLE "album_identities"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_album_identities" RENAME TO "album_identities"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_714972683099919bed8df37ae5" ON "album_identities" ("identity") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_5d1637eeebcc4d11f01202b709"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_album_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, CONSTRAINT "FK_c3655004ed750e7fef8478fa3e1" FOREIGN KEY ("valueBufferUuid") REFERENCES "resources" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5d1637eeebcc4d11f01202b7092" FOREIGN KEY ("entityRelationIdUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_album_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "album_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "album_attributes"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_album_attributes" RENAME TO "album_attributes"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5d1637eeebcc4d11f01202b709" ON "album_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_a09cba87ccc7f63eceb969df7f"`);
		await queryRunner.query(`DROP INDEX "IDX_6fc6d92000fb77e380f2a8e666"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_album_artists" ("albumUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, CONSTRAINT "FK_6fc6d92000fb77e380f2a8e666c" FOREIGN KEY ("albumUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a09cba87ccc7f63eceb969df7f4" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_album_artists"("albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase") SELECT "albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase" FROM "album_artists"`,
		);
		await queryRunner.query(`DROP TABLE "album_artists"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_album_artists" RENAME TO "album_artists"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a09cba87ccc7f63eceb969df7f" ON "album_artists" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fc6d92000fb77e380f2a8e666" ON "album_artists" ("albumUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_5f679419f9dc3dbe91a592cfa5"`);
		await queryRunner.query(`DROP INDEX "IDX_6a0b683aa55b18737aa2965670"`);
		await queryRunner.query(`DROP INDEX "IDX_74b40bd07523b3b2fa6348b0af"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_track_artists" ("trackUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, CONSTRAINT "FK_6a0b683aa55b18737aa29656704" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f679419f9dc3dbe91a592cfa5e" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_track_artists"("trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase") SELECT "trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase" FROM "track_artists"`,
		);
		await queryRunner.query(`DROP TABLE "track_artists"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_track_artists" RENAME TO "track_artists"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f679419f9dc3dbe91a592cfa5" ON "track_artists" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a0b683aa55b18737aa2965670" ON "track_artists" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_74b40bd07523b3b2fa6348b0af" ON "track_artists" ("trackUuid", "artistUuid", "pluginId", "identifierId") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), CONSTRAINT "FK_539d0e84e88b23bfefa83b5647e" FOREIGN KEY ("addedByUuid") REFERENCES "users" ("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_49cbabde34e603619e8701ef63d" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd7ebb66c76e70ed2b5d7270eb8" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "trackUuid"))`,
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
		await queryRunner.query(
			`CREATE TABLE "temporary_playlist_members" ("playlistUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "role" varchar CHECK( "role" IN ('collaborator','viewer') ) NOT NULL DEFAULT ('viewer'), "dateAdded" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_2fd40986390b08d962c1a4dc87e" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c7d6ad459854ac6d2d1de5e5c0" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("playlistUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_playlist_members"("playlistUuid", "userUuid", "role", "dateAdded") SELECT "playlistUuid", "userUuid", "role", "dateAdded" FROM "playlist_members"`,
		);
		await queryRunner.query(`DROP TABLE "playlist_members"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_playlist_members" RENAME TO "playlist_members"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_smart_playlist_filters" ("uuid" varchar PRIMARY KEY NOT NULL, "groupUuid" varchar NOT NULL, "entityType" varchar CHECK( "entityType" IN ('track','artist','album') ) NOT NULL, "attributeKey" text NOT NULL, "attributeType" varchar CHECK( "attributeType" IN ('string','integer','decimal','boolean','buffer') ) NOT NULL, "value_boolean" boolean, "value_string" text, "value_int" integer, "value_decimal" double precision, "inverse" boolean NOT NULL DEFAULT (0), "min" double precision, "max" double precision, "partial" boolean, CONSTRAINT "FK_0c95d6dae1df68d7b6f115efbe8" FOREIGN KEY ("groupUuid") REFERENCES "smart_playlist_filter_groups" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_smart_playlist_filters"("uuid", "groupUuid", "entityType", "attributeKey", "attributeType", "value_boolean", "value_string", "value_int", "value_decimal", "inverse", "min", "max", "partial") SELECT "uuid", "groupUuid", "entityType", "attributeKey", "attributeType", "value_boolean", "value_string", "value_int", "value_decimal", "inverse", "min", "max", "partial" FROM "smart_playlist_filters"`,
		);
		await queryRunner.query(`DROP TABLE "smart_playlist_filters"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_smart_playlist_filters" RENAME TO "smart_playlist_filters"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_smart_playlist_filter_groups" ("uuid" varchar PRIMARY KEY NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "playlistUuid" varchar NOT NULL, CONSTRAINT "FK_340a8ea05a7d396b215e7aa89b7" FOREIGN KEY ("playlistUuid") REFERENCES "playlists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_smart_playlist_filter_groups"("uuid", "dateCreated", "playlistUuid") SELECT "uuid", "dateCreated", "playlistUuid" FROM "smart_playlist_filter_groups"`,
		);
		await queryRunner.query(`DROP TABLE "smart_playlist_filter_groups"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_smart_playlist_filter_groups" RENAME TO "smart_playlist_filter_groups"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_b9fea870d77acc569bf6c27aff"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_playlists" ("uuid" varchar PRIMARY KEY NOT NULL, "ownerUuid" varchar, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "dateModified" integer NOT NULL DEFAULT (datetime('now')), "visibility" varchar CHECK( "visibility" IN ('public','unlisted','private') ) NOT NULL DEFAULT ('public'), "lastSmartFilterScanRunId" varchar, CONSTRAINT "FK_af982774e98519f4d03e7c05b79" FOREIGN KEY ("ownerUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION)`,
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
		await queryRunner.query(
			`CREATE TABLE "temporary_privilege" ("userUuid" varchar NOT NULL, "privilegeKey" text NOT NULL, "pluginId" text NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "IDX_userUuid_privilegeKey_pluginId" UNIQUE ("userUuid", "privilegeKey"), CONSTRAINT "FK_f0d94aefb08c507c55303c8aec6" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("userUuid", "privilegeKey", "pluginId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_privilege"("userUuid", "privilegeKey", "pluginId", "dateCreated") SELECT "userUuid", "privilegeKey", "pluginId", "dateCreated" FROM "privilege"`,
		);
		await queryRunner.query(`DROP TABLE "privilege"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_privilege" RENAME TO "privilege"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_user_config_entries" ("pluginId" text NOT NULL, "configId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "userUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, CONSTRAINT "FK_61fba08189aae820e070ad77e4a" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("pluginId", "configId", "key", "ordinal", "userUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_user_config_entries"("pluginId", "configId", "key", "ordinal", "userUuid", "value_string", "value_int", "value_decimal", "value_boolean") SELECT "pluginId", "configId", "key", "ordinal", "userUuid", "value_string", "value_int", "value_decimal", "value_boolean" FROM "user_config_entries"`,
		);
		await queryRunner.query(`DROP TABLE "user_config_entries"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_user_config_entries" RENAME TO "user_config_entries"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "user_config_entries" RENAME TO "temporary_user_config_entries"`,
		);
		await queryRunner.query(
			`CREATE TABLE "user_config_entries" ("pluginId" text NOT NULL, "configId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "userUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, PRIMARY KEY ("pluginId", "configId", "key", "ordinal", "userUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "user_config_entries"("pluginId", "configId", "key", "ordinal", "userUuid", "value_string", "value_int", "value_decimal", "value_boolean") SELECT "pluginId", "configId", "key", "ordinal", "userUuid", "value_string", "value_int", "value_decimal", "value_boolean" FROM "temporary_user_config_entries"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_user_config_entries"`);
		await queryRunner.query(
			`ALTER TABLE "privilege" RENAME TO "temporary_privilege"`,
		);
		await queryRunner.query(
			`CREATE TABLE "privilege" ("userUuid" varchar NOT NULL, "privilegeKey" text NOT NULL, "pluginId" text NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "IDX_userUuid_privilegeKey_pluginId" UNIQUE ("userUuid", "privilegeKey"), PRIMARY KEY ("userUuid", "privilegeKey", "pluginId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "privilege"("userUuid", "privilegeKey", "pluginId", "dateCreated") SELECT "userUuid", "privilegeKey", "pluginId", "dateCreated" FROM "temporary_privilege"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_privilege"`);
		await queryRunner.query(`DROP INDEX "IDX_b9fea870d77acc569bf6c27aff"`);
		await queryRunner.query(
			`ALTER TABLE "playlists" RENAME TO "temporary_playlists"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlists" ("uuid" varchar PRIMARY KEY NOT NULL, "ownerUuid" varchar, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "dateModified" integer NOT NULL DEFAULT (datetime('now')), "visibility" varchar CHECK( "visibility" IN ('public','unlisted','private') ) NOT NULL DEFAULT ('public'), "lastSmartFilterScanRunId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "playlists"("uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId") SELECT "uuid", "ownerUuid", "dateCreated", "dateModified", "visibility", "lastSmartFilterScanRunId" FROM "temporary_playlists"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlists"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9fea870d77acc569bf6c27aff" ON "playlists" ("lastSmartFilterScanRunId") `,
		);
		await queryRunner.query(
			`ALTER TABLE "smart_playlist_filter_groups" RENAME TO "temporary_smart_playlist_filter_groups"`,
		);
		await queryRunner.query(
			`CREATE TABLE "smart_playlist_filter_groups" ("uuid" varchar PRIMARY KEY NOT NULL, "dateCreated" integer NOT NULL DEFAULT (datetime('now')), "playlistUuid" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`INSERT INTO "smart_playlist_filter_groups"("uuid", "dateCreated", "playlistUuid") SELECT "uuid", "dateCreated", "playlistUuid" FROM "temporary_smart_playlist_filter_groups"`,
		);
		await queryRunner.query(
			`DROP TABLE "temporary_smart_playlist_filter_groups"`,
		);
		await queryRunner.query(
			`ALTER TABLE "smart_playlist_filters" RENAME TO "temporary_smart_playlist_filters"`,
		);
		await queryRunner.query(
			`CREATE TABLE "smart_playlist_filters" ("uuid" varchar PRIMARY KEY NOT NULL, "groupUuid" varchar NOT NULL, "entityType" varchar CHECK( "entityType" IN ('track','artist','album') ) NOT NULL, "attributeKey" text NOT NULL, "attributeType" varchar CHECK( "attributeType" IN ('string','integer','decimal','boolean','buffer') ) NOT NULL, "value_boolean" boolean, "value_string" text, "value_int" integer, "value_decimal" double precision, "inverse" boolean NOT NULL DEFAULT (0), "min" double precision, "max" double precision, "partial" boolean)`,
		);
		await queryRunner.query(
			`INSERT INTO "smart_playlist_filters"("uuid", "groupUuid", "entityType", "attributeKey", "attributeType", "value_boolean", "value_string", "value_int", "value_decimal", "inverse", "min", "max", "partial") SELECT "uuid", "groupUuid", "entityType", "attributeKey", "attributeType", "value_boolean", "value_string", "value_int", "value_decimal", "inverse", "min", "max", "partial" FROM "temporary_smart_playlist_filters"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_smart_playlist_filters"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_members" RENAME TO "temporary_playlist_members"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_members" ("playlistUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "role" varchar CHECK( "role" IN ('collaborator','viewer') ) NOT NULL DEFAULT ('viewer'), "dateAdded" integer NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("playlistUuid", "userUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_members"("playlistUuid", "userUuid", "role", "dateAdded") SELECT "playlistUuid", "userUuid", "role", "dateAdded" FROM "temporary_playlist_members"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_members"`);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_tracks" RENAME TO "temporary_playlist_tracks"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_tracks" ("playlistUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), "ordinal" integer NOT NULL DEFAULT (0), "addedByUuid" varchar, CONSTRAINT "IDX_playlistUuid_trackUuid" UNIQUE ("playlistUuid", "trackUuid"), PRIMARY KEY ("playlistUuid", "trackUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_tracks"("playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid") SELECT "playlistUuid", "trackUuid", "dateAdded", "ordinal", "addedByUuid" FROM "temporary_playlist_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_tracks"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_playlist_tracks_sort" ON "playlist_tracks" ("playlistUuid", "dateAdded", "ordinal") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_74b40bd07523b3b2fa6348b0af"`);
		await queryRunner.query(`DROP INDEX "IDX_6a0b683aa55b18737aa2965670"`);
		await queryRunner.query(`DROP INDEX "IDX_5f679419f9dc3dbe91a592cfa5"`);
		await queryRunner.query(
			`ALTER TABLE "track_artists" RENAME TO "temporary_track_artists"`,
		);
		await queryRunner.query(
			`CREATE TABLE "track_artists" ("trackUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, PRIMARY KEY ("trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "track_artists"("trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase") SELECT "trackUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase" FROM "temporary_track_artists"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_track_artists"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_74b40bd07523b3b2fa6348b0af" ON "track_artists" ("trackUuid", "artistUuid", "pluginId", "identifierId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a0b683aa55b18737aa2965670" ON "track_artists" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f679419f9dc3dbe91a592cfa5" ON "track_artists" ("artistUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_6fc6d92000fb77e380f2a8e666"`);
		await queryRunner.query(`DROP INDEX "IDX_a09cba87ccc7f63eceb969df7f"`);
		await queryRunner.query(
			`ALTER TABLE "album_artists" RENAME TO "temporary_album_artists"`,
		);
		await queryRunner.query(
			`CREATE TABLE "album_artists" ("albumUuid" varchar NOT NULL, "artistUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, "joinPhrase" text, PRIMARY KEY ("albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "album_artists"("albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase") SELECT "albumUuid", "artistUuid", "ordinal", "pluginId", "identifierId", "joinPhrase" FROM "temporary_album_artists"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_album_artists"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fc6d92000fb77e380f2a8e666" ON "album_artists" ("albumUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a09cba87ccc7f63eceb969df7f" ON "album_artists" ("artistUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_5d1637eeebcc4d11f01202b709"`);
		await queryRunner.query(
			`ALTER TABLE "album_attributes" RENAME TO "temporary_album_attributes"`,
		);
		await queryRunner.query(
			`CREATE TABLE "album_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "album_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "temporary_album_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_album_attributes"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5d1637eeebcc4d11f01202b709" ON "album_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_714972683099919bed8df37ae5"`);
		await queryRunner.query(
			`ALTER TABLE "album_identities" RENAME TO "temporary_album_identities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "album_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "albumUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "albumUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "album_identities"("pluginId", "identifierId", "albumUuid", "ordinal", "identity") SELECT "pluginId", "identifierId", "albumUuid", "ordinal", "identity" FROM "temporary_album_identities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_album_identities"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_714972683099919bed8df37ae5" ON "album_identities" ("identity") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_ac7fac9bbe236386b632f6910c"`);
		await queryRunner.query(`DROP INDEX "IDX_7613147c00e13bfe5476a126ab"`);
		await queryRunner.query(
			`ALTER TABLE "album_tracks" RENAME TO "temporary_album_tracks"`,
		);
		await queryRunner.query(
			`CREATE TABLE "album_tracks" ("albumUuid" varchar NOT NULL, "trackUuid" varchar NOT NULL, "discNumber" integer NOT NULL DEFAULT (1), "trackNumber" integer NOT NULL DEFAULT (0), "pluginId" text NOT NULL, "identifierId" text NOT NULL, PRIMARY KEY ("albumUuid", "trackUuid", "pluginId", "identifierId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "album_tracks"("albumUuid", "trackUuid", "discNumber", "trackNumber", "pluginId", "identifierId") SELECT "albumUuid", "trackUuid", "discNumber", "trackNumber", "pluginId", "identifierId" FROM "temporary_album_tracks"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_album_tracks"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac7fac9bbe236386b632f6910c" ON "album_tracks" ("albumUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7613147c00e13bfe5476a126ab" ON "album_tracks" ("trackUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_32e3a95788779780afdaebbe8b"`);
		await queryRunner.query(
			`ALTER TABLE "artist_attributes" RENAME TO "temporary_artist_attributes"`,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "artist_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "temporary_artist_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_artist_attributes"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_32e3a95788779780afdaebbe8b" ON "artist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(
			`ALTER TABLE "artist_identities" RENAME TO "temporary_artist_identities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "artist_identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "artistUuid" varchar NOT NULL, "target" varchar CHECK( "target" IN ('track','artist','album') ) NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "artistUuid", "target", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "artist_identities"("pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity") SELECT "pluginId", "identifierId", "artistUuid", "target", "ordinal", "identity" FROM "temporary_artist_identities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_artist_identities"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_868ef056b20d0fe1e1a25d506a" ON "artist_identities" ("artistUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c21d399593a92ff73d8bdc0f5" ON "artist_identities" ("identity") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_fe7cc12d56511236176a302d28"`);
		await queryRunner.query(`DROP INDEX "IDX_bc80f875cbf2a9d8689dde7e31"`);
		await queryRunner.query(
			`ALTER TABLE "identities" RENAME TO "temporary_identities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "identities" ("pluginId" text NOT NULL, "identifierId" text NOT NULL, "trackUuid" varchar NOT NULL, "ordinal" integer NOT NULL DEFAULT (0), "identity" text NOT NULL, PRIMARY KEY ("pluginId", "identifierId", "trackUuid", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "identities"("pluginId", "identifierId", "trackUuid", "ordinal", "identity") SELECT "pluginId", "identifierId", "trackUuid", "ordinal", "identity" FROM "temporary_identities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_identities"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_fe7cc12d56511236176a302d28" ON "identities" ("trackUuid") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc80f875cbf2a9d8689dde7e31" ON "identities" ("identity") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_1c3a2855975b65a51bed0c8140"`);
		await queryRunner.query(
			`ALTER TABLE "track_attributes" RENAME TO "temporary_track_attributes"`,
		);
		await queryRunner.query(
			`CREATE TABLE "track_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "track_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "temporary_track_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_track_attributes"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c3a2855975b65a51bed0c8140" ON "track_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_d53189ffb31b08f5b42f85f199"`);
		await queryRunner.query(
			`ALTER TABLE "playlist_attributes" RENAME TO "temporary_playlist_attributes"`,
		);
		await queryRunner.query(
			`CREATE TABLE "playlist_attributes" ("entityId" varchar NOT NULL, "pluginId" text NOT NULL, "sourceId" text NOT NULL, "key" text NOT NULL, "ordinal" integer NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, "valueBufferUuid" varchar, "entityRelationIdUuid" varchar, PRIMARY KEY ("entityId", "pluginId", "sourceId", "key", "ordinal"))`,
		);
		await queryRunner.query(
			`INSERT INTO "playlist_attributes"("entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid") SELECT "entityId", "pluginId", "sourceId", "key", "ordinal", "value_string", "value_int", "value_decimal", "value_boolean", "valueBufferUuid", "entityRelationIdUuid" FROM "temporary_playlist_attributes"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_playlist_attributes"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d53189ffb31b08f5b42f85f199" ON "playlist_attributes" ("entityRelationIdUuid") `,
		);
		await queryRunner.query(
			`ALTER TABLE "workflow_steps" RENAME TO "temporary_workflow_steps"`,
		);
		await queryRunner.query(
			`CREATE TABLE "workflow_steps" ("uuid" varchar PRIMARY KEY NOT NULL, "workflowUuid" varchar NOT NULL, "stepType" varchar CHECK( "stepType" IN ('trigger','step') ) NOT NULL, "previousStepUuid" varchar, "pluginId" text, "stepId" text, CONSTRAINT "REL_395aa65c53bf7ea6fa338a8554" UNIQUE ("previousStepUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "workflow_steps"("uuid", "workflowUuid", "stepType", "previousStepUuid", "pluginId", "stepId") SELECT "uuid", "workflowUuid", "stepType", "previousStepUuid", "pluginId", "stepId" FROM "temporary_workflow_steps"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_workflow_steps"`);
		await queryRunner.query(
			`ALTER TABLE "workflow_step_option_values" RENAME TO "temporary_workflow_step_option_values"`,
		);
		await queryRunner.query(
			`CREATE TABLE "workflow_step_option_values" ("optionId" text NOT NULL, "stepUuid" varchar NOT NULL, "value_string" text, "value_int" integer, "value_decimal" double precision, "value_boolean" boolean, PRIMARY KEY ("optionId", "stepUuid"))`,
		);
		await queryRunner.query(
			`INSERT INTO "workflow_step_option_values"("optionId", "stepUuid", "value_string", "value_int", "value_decimal", "value_boolean") SELECT "optionId", "stepUuid", "value_string", "value_int", "value_decimal", "value_boolean" FROM "temporary_workflow_step_option_values"`,
		);
		await queryRunner.query(
			`DROP TABLE "temporary_workflow_step_option_values"`,
		);
		await queryRunner.query(`DROP TABLE "marketplaces"`);
		await queryRunner.query(`DROP TABLE "config_entries"`);
		await queryRunner.query(`DROP TABLE "user_config_entries"`);
		await queryRunner.query(`DROP TABLE "system-config"`);
		await queryRunner.query(`DROP TABLE "search_config"`);
		await queryRunner.query(`DROP INDEX "IDX_4e52fe0160c4d359149cff5ef8"`);
		await queryRunner.query(`DROP TABLE "resumable-task-progress"`);
		await queryRunner.query(`DROP INDEX "IDX_fe0bb3f6520ee0469504521e71"`);
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`DROP TABLE "privilege"`);
		await queryRunner.query(`DROP INDEX "IDX_b9fea870d77acc569bf6c27aff"`);
		await queryRunner.query(`DROP TABLE "playlists"`);
		await queryRunner.query(`DROP TABLE "smart_playlist_filter_groups"`);
		await queryRunner.query(`DROP TABLE "smart_playlist_filters"`);
		await queryRunner.query(`DROP TABLE "playlist_members"`);
		await queryRunner.query(`DROP INDEX "IDX_playlist_tracks_sort"`);
		await queryRunner.query(`DROP TABLE "playlist_tracks"`);
		await queryRunner.query(`DROP TABLE "tracks"`);
		await queryRunner.query(`DROP INDEX "IDX_74b40bd07523b3b2fa6348b0af"`);
		await queryRunner.query(`DROP INDEX "IDX_6a0b683aa55b18737aa2965670"`);
		await queryRunner.query(`DROP INDEX "IDX_5f679419f9dc3dbe91a592cfa5"`);
		await queryRunner.query(`DROP TABLE "track_artists"`);
		await queryRunner.query(`DROP TABLE "artists"`);
		await queryRunner.query(`DROP INDEX "IDX_6fc6d92000fb77e380f2a8e666"`);
		await queryRunner.query(`DROP INDEX "IDX_a09cba87ccc7f63eceb969df7f"`);
		await queryRunner.query(`DROP TABLE "album_artists"`);
		await queryRunner.query(`DROP TABLE "albums"`);
		await queryRunner.query(`DROP INDEX "IDX_5d1637eeebcc4d11f01202b709"`);
		await queryRunner.query(`DROP TABLE "album_attributes"`);
		await queryRunner.query(`DROP INDEX "IDX_714972683099919bed8df37ae5"`);
		await queryRunner.query(`DROP TABLE "album_identities"`);
		await queryRunner.query(`DROP INDEX "IDX_ac7fac9bbe236386b632f6910c"`);
		await queryRunner.query(`DROP INDEX "IDX_7613147c00e13bfe5476a126ab"`);
		await queryRunner.query(`DROP TABLE "album_tracks"`);
		await queryRunner.query(`DROP INDEX "IDX_32e3a95788779780afdaebbe8b"`);
		await queryRunner.query(`DROP TABLE "artist_attributes"`);
		await queryRunner.query(`DROP INDEX "IDX_868ef056b20d0fe1e1a25d506a"`);
		await queryRunner.query(`DROP INDEX "IDX_9c21d399593a92ff73d8bdc0f5"`);
		await queryRunner.query(`DROP TABLE "artist_identities"`);
		await queryRunner.query(`DROP INDEX "IDX_fe7cc12d56511236176a302d28"`);
		await queryRunner.query(`DROP INDEX "IDX_bc80f875cbf2a9d8689dde7e31"`);
		await queryRunner.query(`DROP TABLE "identities"`);
		await queryRunner.query(`DROP INDEX "IDX_1c3a2855975b65a51bed0c8140"`);
		await queryRunner.query(`DROP TABLE "track_attributes"`);
		await queryRunner.query(`DROP INDEX "IDX_d53189ffb31b08f5b42f85f199"`);
		await queryRunner.query(`DROP TABLE "playlist_attributes"`);
		await queryRunner.query(`DROP TABLE "resources"`);
		await queryRunner.query(`DROP TABLE "workflows"`);
		await queryRunner.query(`DROP TABLE "workflow_steps"`);
		await queryRunner.query(`DROP TABLE "workflow_step_option_values"`);
	}
}
