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
import { AttributeSourceOrderDto } from "src/attribute-sources/dto/attribute-source-order.dto";
import { AttributeSourceResponse } from "src/attributes/response/attribute-source.response";
import { CachedLoadedAttributeSource } from "src/attributes/interface/loaded-attribute-source.interface";
import { Privileges } from "src/privileges/privileges.decorator";
import { PrivilegesService } from "src/privileges/privileges.service";

@Controller("attribute-sources")
export class AttributeSourcesController {
	constructor(
		private readonly attributeSourcesService: AttributeSourcesService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(
			null,
			"edit-attribute-source-order",
		);
	}

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
	@Privileges("edit_attribute_source_order")
	@ApiOperation({ operationId: "setAttributeSourceOrder" })
	@ApiOkResponse({
		type: [AttributeSourceResponse],
	})
	@HttpCode(HttpStatus.OK)
	setOrder(@Body() body: AttributeSourceOrderDto) {
		this.attributeSourcesService.setSourceOrder(body.sources);
		return this.getAll();
	}

	private toResponse(
		source: CachedLoadedAttributeSource,
	): AttributeSourceResponse {
		return {
			pluginId: source.plugin.package.name,
			sourceId: source.source.id,
			name: source.source.getName(),
			enabled: source.enabled,
		};
	}
}
