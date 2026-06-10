import { Request } from "express";

function firstHeader(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	return value.split(",")[0].trim();
}

const BASE_PATH = process.env.BASE_PATH ?? null;

export function getBaseUrl(request: Request) {
	const protocol =
		firstHeader(request.get("x-forwarded-proto")) ?? request.protocol;

	const host =
		firstHeader(request.get("x-forwarded-host")) ?? request.get("host");

	if (!host) {
		throw new Error("Host not specified");
	}

	let baseUrl = `${protocol}://${host}`;
	if (!BASE_PATH || BASE_PATH == "/") {
		return baseUrl;
	}

	if (!BASE_PATH.startsWith("/")) {
		baseUrl += "/";
	}

	return `${baseUrl}${BASE_PATH}`;
}
