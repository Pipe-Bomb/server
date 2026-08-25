import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	Query,
	Res,
	UnauthorizedException,
} from "@nestjs/common";
import { LoginDto } from "./dto/login.dto";
import {
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { UserResponse } from "./response/user.response";
import type { Response } from "express";
import { ReqUser } from "./user.decorator";
import { FetchUserPipe } from "./user.pipe";
import { DBUser } from "./entity/user.entity";
import { OptionalAuth } from "../user-manager/optional-auth.decorator";
import { PlaylistVisibility } from "src/playlists/enum/playlist-visibility.enum";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { PrivilegesService } from "src/privileges/privileges.service";
import type { UserJwtPayload } from "./interface/user-jwt-payload.interface";
import { SystemConfigService } from "src/system-config/system-config.service";

@Controller("users")
export class UsersController {
	constructor(
		private readonly userManagerService: UserManagerService,
		private readonly privilegesService: PrivilegesService,
		private readonly systemConfigService: SystemConfigService,
	) {
		this.systemConfigService.registerOption(
			"allow-user-registrations",
			"boolean",
			{
				supportsMultiple: false,
			},
			true,
		);
	}

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

	@Get()
	@ApiOperation({
		operationId: "getAllUsers",
	})
	@ApiOkResponse({
		type: [UserResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	async getAllUsers(): Promise<UserResponse[]> {
		const users = await this.userManagerService.all();
		return users.map((user) => user.toResponse());
	}

	@Post("login")
	@OptionalAuth()
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
		const user = await this.userManagerService.login(
			dto.username,
			dto.password,
		);

		const jwt = await this.userManagerService.generateJwt(user);
		this.setAuthCookie(response, jwt);

		return user.toResponse(
			this.privilegesService.toPrivilegeList(user.uuid, user.privileges!),
		);
	}

	@Post("signup")
	@OptionalAuth()
	@ApiOperation({ operationId: "createUser" })
	@ApiCreatedResponse({
		type: UserResponse,
	})
	@ApiConflictResponse()
	@ApiForbiddenResponse()
	async signup(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<UserResponse> {
		const isFirstUser = (await this.userManagerService.count()) === 0;

		if (!isFirstUser) {
			const allowRegistrations = await this.systemConfigService.getOption(
				"allow-user-registrations",
				"boolean",
			);
			if (!allowRegistrations) {
				throw new ForbiddenException("Registrations are disabled");
			}
		}

		const user = await this.userManagerService.create(
			dto.username,
			dto.password,
			isFirstUser,
		);

		if (isFirstUser) {
			this.privilegesService.registerOwner(user.uuid);
		}

		const jwt = await this.userManagerService.generateJwt(user);
		this.setAuthCookie(response, jwt);

		const privileges = isFirstUser
			? this.privilegesService.toPrivilegeList(user.uuid, [])
			: [];
		return user.toResponse(privileges);
	}

	@Get("me")
	@ApiOperation({ operationId: "getSelf" })
	@ApiOkResponse({
		type: UserResponse,
	})
	@ApiUnauthorizedResponse()
	async getSelf(@ReqUser() jwt: UserJwtPayload): Promise<UserResponse> {
		const user = await this.userManagerService.findOne(jwt.sub, {
			withPrivileges: true,
		});
		if (!user) {
			throw new UnauthorizedException();
		}

		return user.toResponse(
			this.privilegesService.toPrivilegeList(user.uuid, user.privileges!),
		);
	}

	@Post("logout")
	@ApiOperation({ operationId: "logoutUser" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	logout(@Res({ passthrough: true }) response: Response) {
		response.clearCookie("auth_token", {
			httpOnly: true,
			secure: process.env.NODE_ENV == "production",
			sameSite: "lax",
			path: "/",
		});
	}

	@Get("search")
	@ApiOperation({ operationId: "searchUsers" })
	@ApiOkResponse({ type: [UserResponse] })
	@ApiUnauthorizedResponse()
	async searchUsers(@Query("q") q: string): Promise<UserResponse[]> {
		if (!q?.trim()) return [];
		const users = await this.userManagerService.searchByUsername(q.trim());
		return users.map((u) => u.toResponse());
	}

	@Get(":uuid")
	@ApiOperation({ operationId: "getUser" })
	@ApiOkResponse({
		type: UserResponse,
	})
	@OptionalAuth()
	@ApiNotFoundResponse()
	async getUser(
		@Param("uuid") uuid: string,
		@ReqUser(FetchUserPipe) user?: DBUser,
	) {
		const subject = await this.userManagerService.findOne(uuid, {
			withPlaylists: true,
			withPlaylistAttributes: true,
		});
		if (!subject) {
			throw new NotFoundException("User not found");
		}
		if (subject.playlists && (!user || user.uuid != uuid)) {
			subject.playlists = subject.playlists.filter(
				(playlist) => playlist.visibility == PlaylistVisibility.PUBLIC,
			);
		}
		return subject.toResponse();
	}
}
