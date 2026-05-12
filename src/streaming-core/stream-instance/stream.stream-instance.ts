import { StreamAudioMetadata, StreamAudioProducer } from "@sdk";
import { StreamInstance } from "./stream-instance";

export class StreamStreamInstance extends StreamInstance<StreamAudioProducer> {
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
