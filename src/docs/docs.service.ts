import { Injectable } from "@nestjs/common";
import { OpenAPIObject } from "@nestjs/swagger";
import { mkdirSync, writeFileSync } from "fs";

@Injectable()
export class DocsService {
	private document: OpenAPIObject;

	setDocument(doc: OpenAPIObject) {
		this.document = doc;

		mkdirSync("./openapi", {
			recursive: true,
		});
		writeFileSync("./openapi/spec.json", JSON.stringify(doc, null, 2));
	}

	getDocument(): OpenAPIObject {
		return this.document;
	}
}
