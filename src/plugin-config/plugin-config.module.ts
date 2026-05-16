import { Module } from "@nestjs/common";
import { PluginConfigService } from "./plugin-config.service";
import { PluginConfigController } from "./plugin-config.controller";

@Module({
	controllers: [PluginConfigController],
	providers: [PluginConfigService],
	exports: [PluginConfigService],
})
export class PluginConfigModule {}
