import * as DotEnv from "dotenv";

DotEnv.config({ quiet: true });

export const PORT = parseInt(process.env.PORT ?? "3000", 10);
