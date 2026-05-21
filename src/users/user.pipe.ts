import {
	Injectable,
	PipeTransform,
	UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserJwtPayload } from "./interface/user-jwt-payload.interface";
import { DBUser } from "./entity/user.entity";

@Injectable()
export class FetchUserPipe implements PipeTransform {
	constructor(private readonly usersService: UsersService) {}

	async transform(payload: UserJwtPayload): Promise<DBUser> {
		if (!payload || !payload.sub) {
			throw new UnauthorizedException("Invalid user context");
		}

		const user = await this.usersService.findOne(payload.sub);

		if (!user) {
			throw new UnauthorizedException("User has been deleted");
		}

		return user;
	}
}
