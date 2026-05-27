import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBUser } from "./entity/user.entity";
import { SecretsModule } from "src/secrets/secrets.module";
import { JwtModule } from "@nestjs/jwt";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBUser]),
		JwtModule.register({}),
		SecretsModule,
	],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
