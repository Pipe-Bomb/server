import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".development.env" });

export default new DataSource({
	type: "better-sqlite3",
	database: process.env.DB_FILE ?? "dev.sqlite",
	entities: ["src/**/*.entity{.ts,.js}"],
	migrations: ["src/migrations/*{.ts,.js}"],
});
