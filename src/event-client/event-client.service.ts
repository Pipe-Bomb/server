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

const NO_RELATIONS = {
	noRelations: true,
} as const;

const EVENT_BINDINGS: Record<keyof EventMap, ServerEventBinding> = {
	"track-added": bindEvent("track.added", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"track-removed": bindEvent("track.removed", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"track-identities-updated": bindEvent("track.identities.updated", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"track-attributes-updated": bindEvent("track.attributes.updated", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"track-artists-updated": bindEvent("track.artists.updated", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"track-albums-updated": bindEvent("track.albums.updated", (track) => [
		track.toSavedResponse(NO_RELATIONS),
	]),
	"album-added": bindEvent("album.added", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),
	"album-removed": bindEvent("album.removed", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),
	"album-identities-updated": bindEvent("album.identities.updated", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),
	"album-attributes-updated": bindEvent("album.attributes.updated", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),
	"album-tracklist-updated": bindEvent("album.tracklist.updated", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),
	"album-artists-updated": bindEvent("album.artists.updated", (album) => [
		album.toSavedResponse(NO_RELATIONS),
	]),

	"artist-added": bindEvent("artist.added", (artist) => [
		artist.toSavedResponse(NO_RELATIONS),
	]),
	"artist-removed": bindEvent("artist.removed", (artist) => [
		artist.toSavedResponse(NO_RELATIONS),
	]),
	"artist-identities-updated": bindEvent(
		"artist.identities.updated",
		(artist) => [artist.toSavedResponse(NO_RELATIONS)],
	),
	"artist-attributes-updated": bindEvent(
		"artist.attributes.updated",
		(artist) => [artist.toSavedResponse(NO_RELATIONS)],
	),

	"playlist-added": bindEvent("playlist.added", (playlist) => [
		playlist.toSavedResponse(NO_RELATIONS),
	]),
	"playlist-removed": bindEvent("playlist.removed", (playlist) => [
		playlist.toSavedResponse(NO_RELATIONS),
	]),
	"playlist-attributes-updated": bindEvent(
		"playlist.attributes.updated",
		(playlist) => [playlist.toSavedResponse(NO_RELATIONS)],
	),
	"playlist-tracklist-updated": bindEvent(
		"playlist.tracklist.updated",
		(playlist) => [playlist.toSavedResponse(NO_RELATIONS)],
	),
	"playlist-visibility-updated": bindEvent(
		"playlist.visibility.updated",
		(playlist) => [playlist.toSavedResponse(NO_RELATIONS)],
	),
	"playlist-members-updated": bindEvent(
		"playlist.members.updated",
		(playlist) => [playlist.toSavedResponse(NO_RELATIONS)],
	),
	"playlist-filters-updated": bindEvent(
		"playlist.filters.updated",
		(playlist) => [playlist.toSavedResponse(NO_RELATIONS)],
	),

	"user-added": bindEvent("user.added", (user) => [
		user.toSavedResponse(NO_RELATIONS),
	]),
	"user-saved-track": bindEvent("user.track.saved", ([user, track]) => [
		user.toSavedResponse(NO_RELATIONS),
		track.toSavedResponse(NO_RELATIONS),
	]),
	"user-unsaved-track": bindEvent("user.track.unsaved", ([user, track]) => [
		user.toSavedResponse(NO_RELATIONS),
		track.toSavedResponse(NO_RELATIONS),
	]),
	"user-saved-artist": bindEvent("user.artist.saved", ([user, artist]) => [
		user.toSavedResponse(NO_RELATIONS),
		artist.toSavedResponse(NO_RELATIONS),
	]),
	"user-unsaved-artist": bindEvent("user.artist.unsaved", ([user, artist]) => [
		user.toSavedResponse(NO_RELATIONS),
		artist.toSavedResponse(NO_RELATIONS),
	]),
	"user-saved-album": bindEvent("user.album.saved", ([user, album]) => [
		user.toSavedResponse(NO_RELATIONS),
		album.toSavedResponse(NO_RELATIONS),
	]),
	"user-unsaved-album": bindEvent("user.album.unsaved", ([user, album]) => [
		user.toSavedResponse(NO_RELATIONS),
		album.toSavedResponse(NO_RELATIONS),
	]),
};

@Injectable()
export class EventClientService {
	private readonly sdkEmitter = new Emitter<EventMap>();

	constructor(serverEmitter: EventEmitter2) {
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
