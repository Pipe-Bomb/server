import { Injectable, Logger } from "@nestjs/common";
import { OpenAPIObject } from "@nestjs/swagger";
import { existsSync, mkdirSync, writeFileSync } from "fs";

@Injectable()
export class DocsService {
	private readonly logger = new Logger("Docs Service");
	private document: OpenAPIObject;

	setDocument(doc: OpenAPIObject) {
		this.document = doc;

		if (existsSync("./openapi")) {
			writeFileSync("./openapi/spec.json", JSON.stringify(doc, null, 2));
			this.logger.log("Updated OpenAPI spec");
		}
	}

	getDocument(): OpenAPIObject {
		return this.document;
	}
}
