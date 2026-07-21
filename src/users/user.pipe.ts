import { Injectable, PipeTransform } from "@nestjs/common";
import { UserJwtPayload } from "./interface/user-jwt-payload.interface";
import { DBUser } from "./entity/user.entity";
import { UserManagerService } from "src/user-manager/user-manager.service";

@Injectable()
export class FetchUserPipe implements PipeTransform {
	constructor(private readonly userManagerService: UserManagerService) {}

	async transform(payload: UserJwtPayload): Promise<DBUser | undefined> {
		if (!payload || !payload.sub) {
			return undefined;
		}

		const user = await this.userManagerService.findOne(payload.sub);

		if (!user) {
			return undefined;
		}

		return user;
	}
}
