import { Module } from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsController } from "./artists.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DBArtist } from "./entity/artist.entity";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist, DBArtistIdentity, DBTrackArtist]),
	],
	controllers: [ArtistsController],
	providers: [ArtistsService],
	exports: [ArtistsService],
})
export class ArtistsModule {}
