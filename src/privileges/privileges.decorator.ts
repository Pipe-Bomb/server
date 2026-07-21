import { SetMetadata } from "@nestjs/common";

export const PRIVILEGES_KEY = "privileges";
export const Privileges = (...privileges: string[] | ["*"]) =>
	SetMetadata(PRIVILEGES_KEY, privileges);
