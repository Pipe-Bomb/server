import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { Observable, mergeMap } from "rxjs";
import type { Request } from "express";
import { BookmarksService } from "./bookmarks.service";

@Injectable()
export class BookmarksInterceptor implements NestInterceptor {
	constructor(private readonly bookmarksService: BookmarksService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<Request>();
		const userUuid = request.user?.sub ?? null;

		return next
			.handle()
			.pipe(
				mergeMap((data) => this.bookmarksService.annotate(userUuid, data)),
			);
	}
}
