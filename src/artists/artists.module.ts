import { Module } from "@nestjs/common";
import { ArtistsService } from "./artists.service";
import { ArtistsController } from "./artists.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TasksModule } from "src/tasks/tasks.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { DBArtist } from "src/artist-manager/entity/artist.entity";
import { DBSavedArtist } from "./entity/saved-artist.entity";
import { EphemeralService } from "src/ephemeral/ephemeral.service";
import { EphemeralModule } from "src/ephemeral/ephemeral.module";
import { AttributesModule } from "src/attributes/attributes.module";
import { SearchModule } from "src/search/search.module";
import { IdentifiersModule } from "src/identifiers/identifiers.module";
import { UsersModule } from "src/users/users.module";
import { SavedArtistsService } from "./saved-artists.service";

@Module({
	imports: [
		TypeOrmModule.forFeature([DBArtist, DBSavedArtist]),
		TasksModule,
		ArtistManagerModule,
		EphemeralModule,
		AttributesModule,
		SearchModule,
		IdentifiersModule,
		UsersModule,
	],
	controllers: [ArtistsController],
	providers: [ArtistsService, SavedArtistsService],
	exports: [ArtistsService, SavedArtistsService],
})
export class ArtistsModule {}
