import { Injectable } from "@nestjs/common";
import { AudioProducer } from "@sdk";
import { StreamInstance } from "./stream-instance/stream-instance";
import { StreamStreamInstance } from "./stream-instance/stream.stream-instance";
import { HLSStreamInstance } from "./stream-instance/hls.stream-instance";
import { randomUUID } from "crypto";

@Injectable()
export class StreamingCoreService {
	private readonly instances = new Map<string, StreamInstance<AudioProducer>>();

	createStreamInstance(producer: AudioProducer) {
		let id: string;
		do {
			id = randomUUID();
		} while (this.instances.has(id));

		const instance = ((): StreamInstance<AudioProducer> => {
			switch (producer.type) {
				case "stream":
					return new StreamStreamInstance(id, producer);
				case "hls":
					return new HLSStreamInstance(id, producer);
			}
		})();
		this.instances.set(id, instance);
		return instance;
	}

	getInstance(id: string) {
		return this.instances.get(id) ?? null;
	}
}
