jest.mock("@nestjs/event-emitter", () => ({
	EventEmitter2: class EventEmitter2 {},
}));

import { EventClientService } from "./event-client.service";

describe("EventClientService", () => {
	let service: EventClientService;
	let listeners: Map<string, (value: any) => void>;
	let serverEmitter: { on: jest.Mock };

	beforeEach(() => {
		listeners = new Map();
		serverEmitter = {
			on: jest.fn((event: string, callback: (value: any) => void) => {
				listeners.set(event, callback);
			}),
		};

		service = new EventClientService(serverEmitter as any);
	});

	it("binds every server event to an SDK listener", () => {
		expect(serverEmitter.on).toHaveBeenCalledWith(
			"track.artists.updated",
			expect.any(Function),
		);
		expect(serverEmitter.on).toHaveBeenCalledWith(
			"track.albums.updated",
			expect.any(Function),
		);
		expect(serverEmitter.on).toHaveBeenCalledWith(
			"album.artists.updated",
			expect.any(Function),
		);
	});

	it("forwards album.artists.updated to the SDK album-artists-updated event", () => {
		const received: unknown[] = [];
		service.addSdkListener("album-artists-updated", (album) =>
			received.push(album),
		);

		listeners.get("album.artists.updated")!({
			toSavedResponse: () => "saved-album",
		});

		expect(received).toEqual(["saved-album"]);
	});

	it("forwards playlist.filters.updated to the SDK playlist-filters-updated event", () => {
		const received: unknown[] = [];
		service.addSdkListener("playlist-filters-updated", (playlist) =>
			received.push(playlist),
		);

		listeners.get("playlist.filters.updated")!({
			toSavedResponse: () => "saved-playlist",
		});

		expect(received).toEqual(["saved-playlist"]);
	});

	it("forwards track.artists.updated to the SDK track-artists-updated event", () => {
		const received: unknown[] = [];
		service.addSdkListener("track-artists-updated", (track) =>
			received.push(track),
		);

		listeners.get("track.artists.updated")!({
			toSavedResponse: () => "saved-track",
		});

		expect(received).toEqual(["saved-track"]);
	});

	it("stops forwarding after removeSdkListener", () => {
		const received: unknown[] = [];
		const callback = (track: unknown) => received.push(track);
		service.addSdkListener("track-albums-updated", callback);

		listeners.get("track.albums.updated")!({
			toSavedResponse: () => "saved-track",
		});
		expect(received).toEqual(["saved-track"]);

		service.removeSdkListener("track-albums-updated", callback);
		listeners.get("track.albums.updated")!({
			toSavedResponse: () => "saved-track",
		});
		expect(received).toEqual(["saved-track"]);
	});
});
