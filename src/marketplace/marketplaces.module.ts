import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PluginsModule } from "src/plugins/plugins.module";
import { PrivilegesModule } from "src/privileges/privileges.module";
import { DBMarketplace } from "./entity/marketplace.entity";
import { MarketplacesController } from "./marketplaces.controller";
import { MarketplacesService } from "./marketplaces.service";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBMarketplace]),
		PluginsModule,
		PrivilegesModule,
	],
	controllers: [MarketplacesController],
	providers: [MarketplacesService],
})
export class MarketplacesModule {}
