import { Module } from "@nestjs/common";
import { IdentifiersController } from "./identifiers.controller";
import { IdentifiersService } from "./identifiers.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBIdentity } from "./entities/identity.entity";
import { DBDisabledIdentifier } from "./entities/disabled-identifier.entity";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { DisabledIdentifiersService } from "./disabled-identifiers.service";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBIdentity, DBDisabledIdentifier]),
		ArtistManagerModule,
		AlbumManagerModule,
	],
	controllers: [IdentifiersController],
	providers: [IdentifiersService, DisabledIdentifiersService],
	exports: [IdentifiersService, DisabledIdentifiersService],
})
export class IdentifiersModule {}
