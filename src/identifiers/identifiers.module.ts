import { Module } from "@nestjs/common";
import { IdentifiersController } from "./identifiers.controller";
import { IdentifiersService } from "./identifiers.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBIdentity } from "./entities/identity.entity";
import { LibrariesModule } from "src/libraries/libraries.module";
import { ArtistsModule } from "src/artists/artists.module";

@Module({
	imports: [TypeOrmModule.forFeature([DBIdentity]), ArtistsModule],
	controllers: [IdentifiersController],
	providers: [IdentifiersService],
	exports: [IdentifiersService],
})
export class IdentifiersModule {}
