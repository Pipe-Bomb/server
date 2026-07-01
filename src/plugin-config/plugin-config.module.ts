import { Module } from "@nestjs/common";
import { PluginConfigService } from "./plugin-config.service";
import { PluginConfigController } from "./plugin-config.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBConfigEntry } from "./entity/config-entry.entity";
import { DBUserConfigEntry } from "./entity/user-config-entry.entity";
import { UsersModule } from "src/users/users.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBConfigEntry, DBUserConfigEntry]),
		UsersModule,
	],
	controllers: [PluginConfigController],
	providers: [PluginConfigService],
	exports: [PluginConfigService],
})
export class PluginConfigModule {}
