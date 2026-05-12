import { Controller } from "@nestjs/common";
import { AudioCacheService } from "./audio-cache.service";

@Controller()
export class AudioCacheController {
	constructor(private readonly audioCacheService: AudioCacheService) {}
}
