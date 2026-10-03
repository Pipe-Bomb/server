import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1790994281324 implements MigrationInterface {
    name = 'Migration1790994281324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "saved_tracks" ("trackUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_a1de31607099efb12282cbcaf46" FOREIGN KEY ("trackUuid") REFERENCES "tracks" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_bfc50245f8eb15248fa694691e1" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("trackUuid", "userUuid"))`);
        await queryRunner.query(`CREATE TABLE "saved_artists" ("artistUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_7ebc400e211ce4fd05991ab3684" FOREIGN KEY ("artistUuid") REFERENCES "artists" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b60ae77031e40f5423cfd71eb20" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("artistUuid", "userUuid"))`);
        await queryRunner.query(`CREATE TABLE "saved_albums" ("albumUuid" varchar NOT NULL, "userUuid" varchar NOT NULL, "dateAdded" integer NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_1971fd190dc73508f7f8e036784" FOREIGN KEY ("albumUuid") REFERENCES "albums" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d1a567c31aa2c9b1f763a42b2ca" FOREIGN KEY ("userUuid") REFERENCES "users" ("uuid") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("albumUuid", "userUuid"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "saved_albums"`);
        await queryRunner.query(`DROP TABLE "saved_artists"`);
        await queryRunner.query(`DROP TABLE "saved_tracks"`);
    }

}
