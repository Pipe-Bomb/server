import { Module } from "@nestjs/common";
import { EphemeralService } from "./ephemeral.service";
import { EphemeralController } from "./ephemeral.controller";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";
import { ArtistManagerModule } from "src/artist-manager/artist-manager.module";
import { ResourcesModule } from "src/resources/resources.module";

@Module({
	imports: [AttributeSourcesModule, ArtistManagerModule, ResourcesModule],
	controllers: [EphemeralController],
	providers: [EphemeralService],
	exports: [EphemeralService],
})
export class EphemeralModule {}
