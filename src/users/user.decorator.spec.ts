import { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { ReqUser } from "./user.decorator";

interface RouteArgEntry {
	index: number;
	factory: (arg: unknown, ctx: ExecutionContext) => unknown;
	data: unknown;
	pipes: unknown[];
}

function mockContext(user?: unknown): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user }) }),
	} as unknown as ExecutionContext;
}

describe("ReqUser", () => {
	it("returns request.user through the registered parameter factory", () => {
		const context = mockContext({ sub: "user-1", username: "alice" });
		class Dummy {
			method() {}
		}

		ReqUser()(new Dummy(), "method", 0);

		const metadata = Reflect.getMetadata(
			ROUTE_ARGS_METADATA,
			Dummy,
			"method",
		) as Record<string, RouteArgEntry>;
		const entries = Object.values(metadata);
		expect(entries).toHaveLength(1);
		expect(entries[0].index).toBe(0);
		expect(entries[0].factory(undefined, context)).toEqual({
			sub: "user-1",
			username: "alice",
		});
	});

	it("returns undefined when request.user is not set", () => {
		const context = mockContext();
		class Dummy {
			method() {}
		}

		ReqUser()(new Dummy(), "method", 0);

		const metadata = Reflect.getMetadata(
			ROUTE_ARGS_METADATA,
			Dummy,
			"method",
		) as Record<string, RouteArgEntry>;
		const entries = Object.values(metadata);
		expect(entries[0].factory(undefined, context)).toBeUndefined();
	});
});
