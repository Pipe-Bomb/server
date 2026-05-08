import { StreamAudioMetadata, StreamAudioProducer } from "@sdk";
import { Session } from "./session";

export class StreamSession extends Session<StreamAudioProducer> {
	private metadata: StreamAudioMetadata | null;

	async getMetadata() {
		if (!this.metadata) {
			this.metadata = await this.producer.getMetadata();
		}
		return this.metadata;
	}

	getStream() {
		return this.producer.getStream();
	}

	getPart(start: number, end: number) {
		return this.producer.getPart(start, end);
	}
}
