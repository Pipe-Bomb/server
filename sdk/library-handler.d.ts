import { Track } from "./audio-types";
import { AttributeSource } from "./attribute-source";
import { Task, TaskRunContext } from "./task";
import { AudioProducer, AudioProducerType } from "./audio-producer";

export interface LibraryHandlerApiContext {
	addTrack(track: Track, runId: string | null): Promise<void>;
	removeTrack(id: string): Promise<void>;
	useAttributeSource(attributeSource: AttributeSource): void;
	registerPluginTask(task: Task): void;
}

export interface LibraryHandler {
	readonly id: string;

	enable(libraryHandlerApiContext: LibraryHandlerApiContext): void;

	getName(): string;

	getAudioProducer(
		trackId: string,
		type: AudioProducerType | null,
	): Promise<AudioProducer | null>;

	scan(taskRunContext: TaskRunContext): Promise<void>;

	doTracksExist(trackIds: string[]): Promise<string[]>;
}
