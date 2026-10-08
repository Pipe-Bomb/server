import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EventMap } from "sdk/events";
import { Emitter } from "src/util/emitter.util";
import { ServerEventMap } from "./interface/server-event-map.type";

type ServerEventBinding = readonly [
	keyof ServerEventMap,
	(value: any) => EventMap[keyof EventMap],
];

function bindEvent<S extends keyof ServerEventMap, V extends unknown[]>(
	serverEvent: S,
	convert: (value: ServerEventMap[S]) => V,
) {
	return [serverEvent, convert] as const;
}

const EVENT_BINDINGS: Record<keyof EventMap, ServerEventBinding> = {
	"track-added": bindEvent("track.added", (track) => [track.toSavedResponse()]),
	"track-removed": bindEvent("track.removed", (track) => [
		track.toSavedResponse(),
	]),
	"track-identities-updated": bindEvent("track.identities.updated", (track) => [
		track.toSavedResponse(),
	]),
	"track-attributes-updated": bindEvent("track.attributes.updated", (track) => [
		track.toSavedResponse(),
	]),
	"track-artists-updated": bindEvent("track.artists.updated", (track) => [
		track.toSavedResponse(),
	]),
	"track-albums-updated": bindEvent("track.albums.updated", (track) => [
		track.toSavedResponse(),
	]),
	"album-added": bindEvent("album.added", (album) => [album.toSavedResponse()]),
	"album-removed": bindEvent("album.removed", (album) => [
		album.toSavedResponse(),
	]),
	"album-identities-updated": bindEvent("album.identities.updated", (album) => [
		album.toSavedResponse(),
	]),
	"album-attributes-updated": bindEvent("album.attributes.updated", (album) => [
		album.toSavedResponse(),
	]),
	"album-tracklist-updated": bindEvent("album.tracklist.updated", (album) => [
		album.toSavedResponse(),
	]),

	"artist-added": bindEvent("artist.added", (artist) => [
		artist.toSavedResponse(),
	]),
	"artist-removed": bindEvent("artist.removed", (artist) => [
		artist.toSavedResponse(),
	]),
	"artist-identities-updated": bindEvent(
		"artist.identities.updated",
		(artist) => [artist.toSavedResponse()],
	),
	"artist-attributes-updated": bindEvent(
		"artist.attributes.updated",
		(artist) => [artist.toSavedResponse()],
	),

	"playlist-added": bindEvent("playlist.added", (playlist) => [
		playlist.toSavedResponse(),
	]),
	"playlist-removed": bindEvent("playlist.removed", (playlist) => [
		playlist.toSavedResponse(),
	]),
	"playlist-attributes-updated": bindEvent(
		"playlist.attributes.updated",
		(playlist) => [playlist.toSavedResponse()],
	),
	"playlist-tracklist-updated": bindEvent(
		"playlist.tracklist.updated",
		(playlist) => [playlist.toSavedResponse()],
	),
	"playlist-visibility-updated": bindEvent(
		"playlist.visibility.updated",
		(playlist) => [playlist.toSavedResponse()],
	),
	"playlist-members-updated": bindEvent(
		"playlist.members.updated",
		(playlist) => [playlist.toSavedResponse()],
	),

	"user-added": bindEvent("user.added", (user) => [user.toSavedResponse()]),
};

@Injectable()
export class EventClientService {
	private readonly sdkEmitter = new Emitter<EventMap>();

	constructor(private readonly serverEmitter: EventEmitter2) {
		for (const [sdkEventId, [serverEventId, convert]] of Object.entries(
			EVENT_BINDINGS,
		)) {
			serverEmitter.on(serverEventId, (serverValue) => {
				const sdkValue = convert(serverValue);
				this.sdkEmitter.emit(sdkEventId as keyof EventMap, ...sdkValue);
			});
		}
	}

	addSdkListener<T extends keyof EventMap>(
		event: T,
		callback: (...args: EventMap[T]) => void,
	) {
		const end = this.sdkEmitter.on(event, callback);
		return {
			end,
		};
	}

	removeSdkListener<T extends keyof EventMap>(
		event: T,
		callback: (...args: EventMap[T]) => void,
	) {
		return this.sdkEmitter.off(event, callback);
	}
}
