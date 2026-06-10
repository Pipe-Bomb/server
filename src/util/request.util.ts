import { Request } from "express";

function firstHeader(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	return value.split(",")[0].trim();
}

export function getBaseUrl(request: Request) {
	const protocol =
		firstHeader(request.get("x-forwarded-proto")) ?? request.protocol;

	const host =
		firstHeader(request.get("x-forwarded-host")) ?? request.get("host");

	if (!host) {
		throw new Error("Host not specified");
	}

	let baseUrl = `${protocol}://${host}`;
	if (!process.env.BASE_PATH || process.env.BASE_PATH == "/") {
		return baseUrl;
	}

	if (!process.env.BASE_PATH.startsWith("/")) {
		baseUrl += "/";
	}

	return `${baseUrl}${process.env.BASE_PATH}`;
}
