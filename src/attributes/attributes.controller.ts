import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
} from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { AttributeSourceResponse } from "./response/attribute-source.response";
import { AttributeSourceOrderDto } from "./dto/attribute-source-order.dto";

@Controller("attributes")
export class AttributesController {
	constructor(private readonly attributesService: AttributesService) {}
}
