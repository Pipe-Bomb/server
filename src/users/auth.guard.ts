import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { UsersService } from "./users.service";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private usersService: UsersService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();

		let jwt: string | null = null;

		const authHeader = request.headers.authorization;
		if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
			jwt = authHeader.substring("bearer ".length);
		} else {
			jwt = request.cookies?.["auth_token"] ?? null;
		}

		if (!jwt) {
			throw new UnauthorizedException("Authentication token missing");
		}

		const payload = await this.usersService.parseJwt(jwt);
		request.user = payload;

		return true;
	}
}
