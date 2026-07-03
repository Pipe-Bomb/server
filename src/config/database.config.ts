import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { Database } from "better-sqlite3";

export default registerAs("database", (): TypeOrmModuleOptions => {
	const isPostgres = process.env.DB_TYPE == "postgres";

	if (isPostgres) {
		return {
			type: "postgres",
			host: process.env.DB_HOST,
			port: parseInt(process.env.DB_PORT ?? "5432", 10),
			username: process.env.DB_USER,
			password: process.env.DB_PASS,
			database: process.env.DB_NAME,
			// autoLoadEntities: true,
			entities: [__dirname + "/../**/*.entity{.ts,.js}"],
			synchronize: true, // todo: change
		};
	}

	return {
		type: "better-sqlite3",
		database: process.env.DB_FILE ?? "dev.sqlite",
		enableWAL: true,
		// autoLoadEntities: true,
		entities: [__dirname + "/../**/*.entity{.ts,.js}"],
		synchronize: true, // todo: change
		prepareDatabase: (db: Database) => {
			const MEMORY_CACHE_MIB = 512;
			const MMAP_MB = 1024;

			// Speeds up writes. SQLite wont block the thread waiting for physical disk confirmation
			// on every single transaction. Safe to use because WAL mode protects data integrity.
			db.pragma("synchronous = NORMAL");

			// Speeds up complex queries. Forces temporary indices, tables, and sorting operations
			// to happen entirely in RAM instead of creating temporary files on the hard drive.
			db.pragma("temp_store = MEMORY");

			// Reduces disk reads. Reserves a dedicated chunk of RAM (512MB here) to cache
			// database pages. A negative value tells SQLite to calculate the limit in KiB.
			db.pragma(`cache_size = ${MEMORY_CACHE_MIB * -1024}`);

			// Eliminates OS read overhead. Maps the database file directly into virtual memory.
			// Node reads data directly from RAM, skipping slow filesystem read() system calls.
			db.pragma(`mmap_size = ${MMAP_MB * 1024 * 1024}`);
		},
	};
});
