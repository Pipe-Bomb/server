import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";

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
		// autoLoadEntities: true,
		entities: [__dirname + "/../**/*.entity{.ts,.js}"],
		synchronize: true, // todo: change
	};
});
