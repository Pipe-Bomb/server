import { Module } from "@nestjs/common";
import { IdentifiersController } from "./identifiers.controller";
import { IdentifiersService } from "./identifiers.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBIdentity } from "./entities/identity.entity";
import { ArtistsModule } from "src/artists/artists.module";
import { AlbumsModule } from "src/albums/albums.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBIdentity]),
		ArtistsModule,
		AlbumsModule,
	],
	controllers: [IdentifiersController],
	providers: [IdentifiersService],
	exports: [IdentifiersService],
})
export class IdentifiersModule {}
