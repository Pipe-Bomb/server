import { lastValueFrom, of } from "rxjs";
import { BookmarksInterceptor } from "./bookmarks.interceptor";

describe("BookmarksInterceptor", () => {
	const makeContext = (request: any) =>
		({
			switchToHttp: () => ({
				getRequest: () => request,
			}),
		}) as any;

	it("annotates with the request user's uuid", async () => {
		const annotate = jest.fn(async (_userUuid: string | null, data: any) => data);
		const interceptor = new BookmarksInterceptor({ annotate } as any);

		const result = await lastValueFrom(
			interceptor.intercept(makeContext({ user: { sub: "user-1" } }), {
				handle: () => of({ ok: true }),
			}),
		);

		expect(annotate).toHaveBeenCalledWith("user-1", { ok: true });
		expect(result).toEqual({ ok: true });
	});

	it("passes null when there is no authenticated user", async () => {
		const annotate = jest.fn(async (_userUuid: string | null, data: any) => data);
		const interceptor = new BookmarksInterceptor({ annotate } as any);

		await lastValueFrom(
			interceptor.intercept(makeContext({}), {
				handle: () => of({ ok: true }),
			}),
		);

		expect(annotate).toHaveBeenCalledWith(null, { ok: true });
	});
});
