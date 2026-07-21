import { Global, Module } from "@nestjs/common";
import { PrivilegesService } from "./privileges.service";
import { PrivilegesController } from "./privileges.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBPrivilege } from "./entity/privilege.entity";

@Global()
@Module({
	imports: [TypeOrmModule.forFeature([DBPrivilege])],
	controllers: [PrivilegesController],
	providers: [PrivilegesService],
	exports: [PrivilegesService],
})
export class PrivilegesModule {}
