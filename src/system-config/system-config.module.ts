import { Module } from "@nestjs/common";
import { SystemConfigService } from "./system-config.service";
import { SystemConfigController } from "./system-config.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBSystemConfig } from "./entity/system-config.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBSystemConfig])],
	controllers: [SystemConfigController],
	providers: [SystemConfigService],
	exports: [SystemConfigService],
})
export class SystemConfigModule {}
