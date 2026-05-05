import { Readable } from "stream";
import { Track } from "./audio-types";
import { TrackInformationHelper } from "./identifier";
import { AttributeSource } from "./attribute-source";
import { LibraryTrackInformationHelper, TrackInformationHelper } from "./information-helper";
import { Task, TaskRunContext } from "./task";
import { AudioProducer } from "./audio-producer";

export interface LibraryHandlerApiContext {
	addTrack(track: Track): Promise<void>;
	useAttributeSource(attributeSource: AttributeSource): void;
	registerPluginTask(task: Task): void;
}

export interface LibraryHandler {
	public readonly id: string;

	enable(libraryHandlerApiContext: LibraryHandlerApiContext): void;

	getName(): string;

	getInformationHelper(track: Track): Promise<LibraryTrackInformationHelper>;

	getAudioProducer(track: Track): Promise<AudioProducer>;

	scan(TaskRunContext: TaskRunContext): Promise<void>;
}
