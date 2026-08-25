import { Module } from "@nestjs/common";
import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";
import { UserManagerModule } from "src/user-manager/user-manager.module";

@Module({
	imports: [UserManagerModule],
	controllers: [SetupController],
	providers: [SetupService],
})
export class SetupModule {}
