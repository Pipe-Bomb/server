import { Controller, Get } from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { AttributeSourceResponse } from "./response/attribute-source.response";

@Controller("attributes")
export class AttributesController {
	constructor(private readonly attributesService: AttributesService) {}

	@Get()
	@ApiOperation({ operationId: "getAllAttributeSources" })
	@ApiOkResponse({
		type: [AttributeSourceResponse],
	})
	getAll(): AttributeSourceResponse[] {
		return this.attributesService
			.getSources()
			.map((source) => this.attributesService.toResponse(source));
	}
}
