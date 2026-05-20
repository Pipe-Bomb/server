import { Module } from "@nestjs/common";
import { EphemeralService } from "./ephemeral.service";
import { EphemeralController } from "./ephemeral.controller";
import { AttributeSourcesModule } from "src/attribute-sources/attribute-sources.module";

@Module({
	imports: [AttributeSourcesModule],
	controllers: [EphemeralController],
	providers: [EphemeralService],
	exports: [EphemeralService],
})
export class EphemeralModule {}
