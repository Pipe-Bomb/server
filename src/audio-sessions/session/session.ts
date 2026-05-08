import { AudioProducer, AudioProducerType } from "@sdk";
import { SessionResponse } from "../response/session.response";

export abstract class Session<T extends AudioProducer> {
	public readonly type: AudioProducerType;

	constructor(
		public readonly id: string,
		protected readonly producer: T,
	) {
		this.type = producer.type;
	}

	toResponse(): SessionResponse {
		return {
			id: this.id,
			type: this.producer.type,
		};
	}
}
