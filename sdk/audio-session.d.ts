import { AudioProducer, AudioProducerType } from "./audio-producer";

export interface AudioSession {
	getId(): string;
	getType(): AudioProducerType;
	getAudioProducer(): AudioProducer;
}
