import { Controller } from "@nestjs/common";
import { AttributesService } from "./attributes.service";

@Controller("attributes")
export class AttributesController {
	constructor(private readonly attributesService: AttributesService) {}
}
