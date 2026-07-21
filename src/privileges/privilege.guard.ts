import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { PRIVILEGES_KEY } from "./privileges.decorator";
import { PrivilegesService } from "./privileges.service";

@Injectable()
export class PrivilegeGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private readonly privilegesService: PrivilegesService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredPrivileges = this.reflector.getAllAndOverride<string[]>(
			PRIVILEGES_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredPrivileges?.length) {
			return true;
		}

		const { user } = context.switchToHttp().getRequest<Request>();

		if (!user) {
			throw new UnauthorizedException();
		}

		if (this.privilegesService.isAdmin(user.sub)) {
			return true;
		}

		const rawPrivileges = await this.privilegesService.getPrivileges(user.sub);
		const privileges = this.privilegesService
			.toPrivilegeList(user.sub, rawPrivileges)
			.filter((p) => !p.pluginId);

		for (const privilegeKey of requiredPrivileges) {
			let granted = false;
			for (const privilege of privileges) {
				if (privilege.key == privilegeKey) {
					if (!privilege.granted && !privilege.grantedByInclusion) {
						throw new ForbiddenException();
					}
					granted = true;
					break;
				}
			}

			if (!granted) {
				throw new Error(
					`Required privilege "${privilegeKey}" isn't registered`,
				);
			}
		}

		return true;
	}
}
