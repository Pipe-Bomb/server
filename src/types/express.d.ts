import { UserJwtPayload } from "src/users/interface/user-jwt-payload.interface";

declare global {
	namespace Express {
		interface Request {
			user?: UserJwtPayload;
		}
	}
}
