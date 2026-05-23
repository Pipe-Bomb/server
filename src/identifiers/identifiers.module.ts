import { Module } from "@nestjs/common";
import { IdentifiersController } from "./identifiers.controller";
import { IdentifiersService } from "./identifiers.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBIdentity } from "./entities/identity.entity";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBIdentity]),
		ArtistManagerModule,
		AlbumManagerModule,
	],
	controllers: [IdentifiersController],
	providers: [IdentifiersService],
	exports: [IdentifiersService],
})
export class IdentifiersModule {}
