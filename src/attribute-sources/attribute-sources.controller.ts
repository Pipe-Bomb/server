import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
} from "@nestjs/common";
import { AttributeSourcesService } from "./attribute-sources.service";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { AttributeSourceOrderDto } from "src/attributes/dto/attribute-source-order.dto";
import { AttributeSourceResponse } from "src/attributes/response/attribute-source.response";
import { LoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";

@Controller("attribute-sources")
export class AttributeSourcesController {
	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	@Get()
	@ApiOperation({ operationId: "getAllAttributeSources" })
	@ApiOkResponse({
		type: [AttributeSourceResponse],
	})
	getAll(): AttributeSourceResponse[] {
		return this.attributeSourcesService
			.getSources()
			.map((source) => this.toResponse(source));
	}

	@Post("order")
	@ApiOperation({ operationId: "setAttributeSourceOrder" })
	@ApiOkResponse({
		type: [AttributeSourceResponse],
	})
	@HttpCode(HttpStatus.OK)
	setOrder(@Body() body: AttributeSourceOrderDto) {
		this.attributeSourcesService.setSourceOrder(body.sources);
		return this.getAll();
	}

	private toResponse(source: LoadedAttributeSource): AttributeSourceResponse {
		return {
			pluginId: source.plugin.package.name,
			sourceId: source.source.id,
			name: source.source.getName(),
		};
	}
}
