import {
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { AudioCacheService } from "src/audio-cache/audio-cache.service";
import { LibrariesService } from "src/libraries/libraries.service";
import { StreamingCoreService } from "src/streaming-core/streaming-core.service";
import { DBTrack } from "src/tracks/entities/track.entity";

@Injectable()
export class AudioSessionsService {
	private readonly logger = new Logger("Audio Sessions Service");

	constructor(
		private readonly librariesService: LibrariesService,
		private readonly streamingCoreService: StreamingCoreService,
		private readonly audioCacheService: AudioCacheService,
	) {}

	async createSession(track: DBTrack) {
		const library = this.librariesService.findLibrary(
			track.pluginId,
			track.libraryId,
		);
		if (!library) {
			throw new NotFoundException("Library not found");
		}
		const producer = await this.audioCacheService.getAudioProducer(
			library.handler,
			track,
			null,
		);

		if (!producer) {
			throw new ServiceUnavailableException("Unable to create Audio Producer");
		}

		return this.streamingCoreService.createStreamInstance(producer);
	}
}
