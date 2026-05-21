import { Module } from "@nestjs/common";
import { ArtistManagerService } from "./artist-manager.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExternalUrlsModule } from "src/external-urls/external-urls.module";
import { TrackManagerModule } from "src/track-manager/track-manager.module";
import { AlbumManagerModule } from "src/album-manager/album-manager.module";
import { DBArtistIdentity } from "./entity/artist-identity.entity";
import { DBArtist } from "./entity/artist.entity";
import { DBTrackArtist } from "./entity/track-artist.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist, DBArtistIdentity, DBTrackArtist]),
		ExternalUrlsModule,
		TrackManagerModule,
		AlbumManagerModule,
	],
	providers: [ArtistManagerService],
	exports: [ArtistManagerService],
})
export class ArtistManagerModule {}
