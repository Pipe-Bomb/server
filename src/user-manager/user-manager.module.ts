import { Global, Module } from "@nestjs/common";
import { UserManagerService } from "./user-manager.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBUser } from "src/users/entity/user.entity";
import { JwtModule } from "@nestjs/jwt";
import { SecretsModule } from "src/secrets/secrets.module";

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([DBUser]),
		JwtModule.register({}),
		SecretsModule,
	],
	providers: [UserManagerService],
	exports: [UserManagerService],
})
export class UserManagerModule {}
