import { Injectable, PipeTransform } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserJwtPayload } from "./interface/user-jwt-payload.interface";
import { DBUser } from "./entity/user.entity";

@Injectable()
export class FetchUserPipe implements PipeTransform {
	constructor(private readonly usersService: UsersService) {}

	async transform(payload: UserJwtPayload): Promise<DBUser | undefined> {
		if (!payload || !payload.sub) {
			return undefined;
		}

		const user = await this.usersService.findOne(payload.sub);

		if (!user) {
			return undefined;
		}

		return user;
	}
}
