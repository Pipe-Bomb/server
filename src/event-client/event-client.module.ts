import { Module } from "@nestjs/common";
import { EventClientService } from "./event-client.service";

@Module({
	providers: [EventClientService],
	exports: [EventClientService],
})
export class EventClientModule {}
