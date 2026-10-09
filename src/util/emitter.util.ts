import { EventEmitter2 } from "@nestjs/event-emitter";
import { ServerEventMap } from "src/event-client/interface/server-event-map.type";

export type Listener<Args extends unknown[]> = (...args: Args) => void;

export type ListenerMap<M extends Record<string, unknown[]>> = {
	[K in keyof M]?: Set<Listener<M[K]>>;
};

export class Emitter<M extends Record<string, unknown[]>> {
	private listeners: ListenerMap<M> = {};

	on<K extends keyof M>(event: K, cb: Listener<M[K]>) {
		let set = this.listeners[event];
		if (!set) {
			set = new Set();
			this.listeners[event] = set;
		}
		set.add(cb);
		return () => {
			this.off(event, cb);
		};
	}

	off<K extends keyof M>(event: K, cb: Listener<M[K]>) {
		return !!this.listeners[event]?.delete(cb);
	}

	emit<K extends keyof M>(event: K, ...args: M[K]) {
		const set = this.listeners[event];
		if (!set) {
			return;
		}
		for (const cb of set) {
			cb(...args);
		}
	}
}

export function emitServerEvent<E extends keyof ServerEventMap>(
	emitter: EventEmitter2,
	event: E,
	payload: ServerEventMap[E],
): boolean {
	return emitter.emit(event, payload);
}
