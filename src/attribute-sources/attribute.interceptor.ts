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
import { getBaseUrl } from "src/util/request.util";
import { DBAttributeTemplate } from "src/attributes/entities/attribute.entity-template";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";

export class AttributeInterceptor implements NestInterceptor {
	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler<any>,
	): Observable<any> | Promise<Observable<any>> {
		const request: Request = context.switchToHttp().getRequest();

		return next.handle().pipe(
			map((data) => {
				return this.traverse(data, getBaseUrl(request));
			}),
		);
	}

	private traverse(node: any, baseUrl: string): any {
		if (node === null || node === undefined || node instanceof StreamableFile)
			return node;

		if (node instanceof RelativeUrl) {
			return `${baseUrl}${node.url}`;
		}

		if (Array.isArray(node)) {
			return node.map((item) => this.traverse(item, baseUrl));
		}

		if (typeof node === "object") {
			if (
				node.attributes &&
				Array.isArray(node.attributes) &&
				!node.attributes.some(
					(attribute: any) => !(attribute instanceof DBAttributeTemplate),
				)
			) {
				let type: "track" | "artist" | "album" | null = null;
				if (node.attributes.length) {
					const attribute: DBAttributeTemplate = node.attributes[0];
					if (attribute instanceof DBTrackAttribute) {
						type = "track";
					} else if (attribute instanceof DBArtistAttribute) {
						type = "artist";
					} else if (attribute instanceof DBAlbumAttribute) {
						type = "album";
					}
				}

				node.attributes = this.attributeSourcesService.toMap(
					node.attributes,
					type,
				);
			}

			for (const key of Object.keys(node)) {
				node[key] = this.traverse(node[key], baseUrl);
			}
		}

		return node;
	}
}
