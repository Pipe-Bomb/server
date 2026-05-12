import { Controller } from "@nestjs/common";
import { AudioSessionsService } from "./audio-sessions.service";

@Controller("audio-sessions")
export class AudioSessionsController {
	constructor(private readonly audioSessionsService: AudioSessionsService) {}
}
