import { Module } from "@nestjs/common";
import { PluginConfigService } from "./plugin-config.service";
import { PluginConfigController } from "./plugin-config.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBConfigEntry } from "./entity/config-entry.entity";

@Module({
	imports: [TypeOrmModule.forFeature([DBConfigEntry])],
	controllers: [PluginConfigController],
	providers: [PluginConfigService],
	exports: [PluginConfigService],
})
export class PluginConfigModule {}
