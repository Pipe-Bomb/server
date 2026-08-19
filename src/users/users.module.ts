import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBUser } from "./entity/user.entity";
import { UserManagerModule } from "src/user-manager/user-manager.module";
import { SystemConfigModule } from "src/system-config/system-config.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBUser]),
		UserManagerModule,
		SystemConfigModule,
	],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
