import {
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { LibrariesService } from "src/libraries/libraries.service";
import { DBTrack } from "src/tracks/entities/track.entity";
import { Session } from "./session/session";
import { StreamSession } from "./session/stream.session";
import { HLSSession } from "./session/hls.session";
import { AudioProducer } from "@sdk";

@Injectable()
export class AudioSessionsService {
	private readonly logger = new Logger("Audio Sessions Service");
	private readonly sessions = new Map<string, Session<AudioProducer>>();

	constructor(private readonly librariesService: LibrariesService) {}

	public async createSession(track: DBTrack) {
		const library = this.librariesService.findLibrary(
			track.pluginId,
			track.libraryId,
		);
		if (!library) {
			throw new NotFoundException("Library not found");
		}

		const producer = await library.handler.getAudioProducer(
			{
				id: track.trackId,
				title: track.title,
			},
			null,
		);

		if (!producer) {
			throw new ServiceUnavailableException("Unable to create producer");
		}

		let id: string;
		do {
			id = randomUUID();
		} while (this.sessions.has(id));

		const session = ((): Session<AudioProducer> => {
			switch (producer.type) {
				case "stream":
					return new StreamSession(id, producer);
				case "hls":
					return new HLSSession(id, producer);
			}
		})();

		this.sessions.set(id, session);
		return session;
	}

	getSession(id: string) {
		return this.sessions.get(id) ?? null;
	}
}
