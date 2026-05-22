import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Res,
	UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { LoginDto } from "./dto/login.dto";
import {
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { UserResponse } from "./response/user.response";
import type { Response } from "express";
import { AuthGuard } from "./auth.guard";
import { ReqUser } from "./user.decorator";
import { FetchUserPipe } from "./user.pipe";
import { DBUser } from "./entity/user.entity";

@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	private setAuthCookie(response: Response, jwt: string) {
		response.cookie("auth_token", jwt, {
			domain: process.env.COOKIE_DOMAIN,
			httpOnly: true,
			secure: process.env.NODE_ENV == "production",
			sameSite: "lax",
			maxAge: 1000 * 60 * 60 * 24 * 30,
			path: "/",
		});
	}

	@Post("login")
	@ApiOperation({ operationId: "loginUser" })
	@ApiOkResponse({
		type: UserResponse,
	})
	@ApiUnauthorizedResponse()
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<UserResponse> {
		const user = await this.usersService.login(dto.username, dto.password);

		const jwt = await this.usersService.generateJwt(user);
		this.setAuthCookie(response, jwt);

		return user.toResponse();
	}

	@Post("signup")
	@ApiOperation({ operationId: "createUser" })
	@ApiCreatedResponse({
		type: UserResponse,
	})
	@ApiConflictResponse()
	async signup(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<UserResponse> {
		const user = await this.usersService.create(dto.username, dto.password);

		const jwt = await this.usersService.generateJwt(user);
		this.setAuthCookie(response, jwt);

		return user.toResponse();
	}

	@Get("me")
	@ApiOperation({ operationId: "getSelf" })
	@ApiOkResponse({
		type: UserResponse,
	})
	@ApiUnauthorizedResponse()
	@UseGuards(AuthGuard)
	getSelf(@ReqUser(FetchUserPipe) user: DBUser): UserResponse {
		return user.toResponse();
	}

	@Post("logout")
	@ApiOperation({ operationId: "logoutUser" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseGuards(AuthGuard)
	logout(@Res({ passthrough: true }) response: Response) {
		response.clearCookie("auth_token", {
			httpOnly: true,
			secure: process.env.NODE_ENV == "production",
			sameSite: "lax",
			path: "/",
		});
	}
}
