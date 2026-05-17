import {
	CallHandler,
	ExecutionContext,
	NestInterceptor,
	StreamableFile,
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { AttributeSourcesService } from "./attribute-sources.service";
import { RelativeUrl } from "src/interception/relative-url";
import type { Request } from "express";

export class AttributeInterceptor implements NestInterceptor {
	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler<any>,
	): Observable<any> | Promise<Observable<any>> {
		const request: Request = context.switchToHttp().getRequest();

		const protocol = request.get("x-forwarded-proto") ?? request.protocol;
		const host = request.get("x-forwarded-host") ?? request.get("host");
		const baseUrl = `${protocol}://${host}`;

		return next.handle().pipe(
			map((data) => {
				return this.traverse(data, baseUrl);
			}),
		);
	}

	private traverse(node: any, baseUrl: string): any {
		// 1. Handle Null or Undefined
		if (node === null || node === undefined || node instanceof StreamableFile)
			return node;

		if (node instanceof RelativeUrl) {
			return `${baseUrl}${node.url}`;
		}

		// 2. Handle Arrays (Recurse into each element)
		if (Array.isArray(node)) {
			return node.map((item) => this.traverse(item, baseUrl));
		}

		// 3. Handle Objects
		if (typeof node === "object") {
			if (node.attributes && Array.isArray(node.attributes)) {
				node.attributes = this.attributeSourcesService.toMap(node.attributes);
			}

			for (const key of Object.keys(node)) {
				node[key] = this.traverse(node[key], baseUrl);
			}
		}

		return node;
	}
}
