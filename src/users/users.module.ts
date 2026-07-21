import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBUser } from "./entity/user.entity";
import { UserManagerModule } from "src/user-manager/user-manager.module";

@Module({
	imports: [TypeOrmModule.forFeature([DBUser]), UserManagerModule],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
