import { Injectable } from "@nestjs/common";
import { UserManagerService } from "src/user-manager/user-manager.service";

@Injectable()
export class SetupService {
	constructor(private readonly userManagerService: UserManagerService) {}

	async needsSetup(): Promise<boolean> {
		return (await this.userManagerService.count()) === 0;
	}
}
