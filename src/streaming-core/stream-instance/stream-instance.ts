import { AudioProducer, AudioProducerType } from "@sdk";
import { StreamInstanceResponse } from "../response/session.response";
import { StreamInstanceType } from "../enum/session-type.enum";

export abstract class StreamInstance<T extends AudioProducer> {
	public readonly type: AudioProducerType;

	constructor(
		public readonly id: string,
		protected readonly producer: T,
	) {
		this.type = producer.type;
	}

	isCacheable() {
		return this.producer.cacheable;
	}

	getProducer() {
		return this.producer;
	}

	toResponse(): StreamInstanceResponse {
		return {
			id: this.id,
			type: this.producer.type as StreamInstanceType,
		};
	}
}
