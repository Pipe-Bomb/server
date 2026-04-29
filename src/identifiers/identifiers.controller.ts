import { Controller, Get } from "@nestjs/common";
import { IdentifiersService } from "./identifiers.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { IdentifierResponse } from "./response/identifier.response";

@Controller("identifiers")
export class IdentifiersController {
	constructor(private readonly identifiersService: IdentifiersService) {}

	@Get()
	@ApiOperation({ operationId: "getAllIdentifiers" })
	@ApiOkResponse({
		type: [IdentifierResponse],
	})
	getAll(): IdentifierResponse[] {
		const identifiers = this.identifiersService.all();
		return identifiers.map((id) => this.identifiersService.toResponse(id));
	}
}
