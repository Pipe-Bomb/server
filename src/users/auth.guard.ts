import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { UsersService } from "./users.service";
import { Reflector } from "@nestjs/core";
import { IS_AUTH_OPTIONAL_KEY } from "./optional-auth.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private usersService: UsersService,
		private reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isAuthOptional = this.reflector.getAllAndOverride<boolean>(
			IS_AUTH_OPTIONAL_KEY,
			[context.getHandler(), context.getClass()],
		);

		const request = context.switchToHttp().getRequest<Request>();

		let jwt: string | null = null;

		const authHeader = request.headers.authorization;
		if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
			jwt = authHeader.substring("bearer ".length);
		} else {
			jwt = request.cookies?.["auth_token"] ?? null;
		}

		if (!jwt) {
			if (isAuthOptional) {
				return true;
			}
			throw new UnauthorizedException("Authentication token missing");
		}

		try {
			const payload = await this.usersService.parseJwt(jwt);
			request.user = payload;
		} catch (e) {
			if (isAuthOptional) {
				request.user = undefined;
				return true;
			}
			throw e;
		}

		return true;
	}
}
