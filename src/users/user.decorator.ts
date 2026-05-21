// src/auth/decorators/req-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const ReqUser = createParamDecorator(
	(data: unknown, ctx: ExecutionContext) => {
		const request: Request = ctx.switchToHttp().getRequest();
		return request.user; // Returns the JwtPayload object (uuid, username)
	},
);
