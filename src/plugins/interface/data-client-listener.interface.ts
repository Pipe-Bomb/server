import { EventMap } from "sdk/events";

export interface DataClientListener<T extends keyof EventMap = keyof EventMap> {
	event: T;
}
