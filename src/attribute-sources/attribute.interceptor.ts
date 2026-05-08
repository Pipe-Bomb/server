import {
	CallHandler,
	ExecutionContext,
	NestInterceptor,
	StreamableFile,
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { AttributeSourcesService } from "./attribute-sources.service";

export class AttributeInterceptor implements NestInterceptor {
	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler<any>,
	): Observable<any> | Promise<Observable<any>> {
		return next.handle().pipe(
			map((data) => {
				return this.traverse(data);
			}),
		);
	}

	private traverse(node: any): any {
		// 1. Handle Null or Undefined
		if (node === null || node === undefined || node instanceof StreamableFile)
			return node;

		// 2. Handle Arrays (Recurse into each element)
		if (Array.isArray(node)) {
			return node.map((item) => this.traverse(item));
		}

		// 3. Handle Objects
		if (typeof node === "object") {
			if (node.attributes && Array.isArray(node.attributes)) {
				node.attributes = this.attributeSourcesService.toMap(node.attributes);
			}

			for (const key of Object.keys(node)) {
				node[key] = this.traverse(node[key]);
			}
		}

		return node;
	}
}
