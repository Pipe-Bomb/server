import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	Get,
	NotFoundException,
	Param,
	Patch,
	Put,
	UnauthorizedException,
} from "@nestjs/common";
import { PrivilegesService } from "./privileges.service";
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { UserManagerService } from "src/user-manager/user-manager.service";
import { PrivilegeResponse } from "./response/privilege.response";
import { Privileges } from "./privileges.decorator";
import { UpdatePrivilegesDto } from "./dto/update-privileges.dto";
import { ReqUser } from "src/users/user.decorator";
import type { UserJwtPayload } from "src/users/interface/user-jwt-payload.interface";

@Controller("privileges")
export class PrivilegesController {
	constructor(
		private readonly privilegesService: PrivilegesService,
		private readonly userManagerService: UserManagerService,
	) {
		this.privilegesService.registerPrivilege(null, "view-privileges");
	}

	@Get(":userUuid")
	@Privileges("view-privileges")
	@ApiOperation({ operationId: "getUserPrivileges" })
	@ApiOkResponse({
		type: [PrivilegeResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	async getUserPrivileges(
		@Param("userUuid") uuid: string,
	): Promise<PrivilegeResponse[]> {
		const user = await this.userManagerService.findOne(uuid, {
			withPrivileges: true,
		});
		if (!user) {
			throw new UnauthorizedException();
		}
		if (!user.privileges) {
			throw new Error("Privileges not returned from database");
		}

		return this.privilegesService.toPrivilegeList(user.uuid, user.privileges);
	}

	@Patch(":userUuid")
	@Privileges("*")
	@ApiOperation({ operationId: "updateUserPrivileges" })
	@ApiOkResponse({
		type: [PrivilegeResponse],
	})
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	@ApiConflictResponse()
	@ApiBadRequestResponse()
	async updateUserPrivileges(
		@Param("userUuid") uuid: string,
		@Body() dto: UpdatePrivilegesDto,
		@ReqUser() self: UserJwtPayload,
	) {
		const user = await this.userManagerService.findOne(uuid);
		if (!user) {
			throw new NotFoundException("User not found");
		}
		if (user.uuid == self.sub) {
			throw new ConflictException("Cannot modify own privileges");
		}
		if (this.privilegesService.isAdmin(user.uuid)) {
			throw new BadRequestException("Cannot modify privileges of admin");
		}

		await this.privilegesService.updatePrivileges(user, dto.privileges);
		return this.getUserPrivileges(user.uuid);
	}
}
