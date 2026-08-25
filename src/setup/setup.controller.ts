import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { SetupService } from "./setup.service";
import { OptionalAuth } from "src/user-manager/optional-auth.decorator";

@Controller("setup")
export class SetupController {
	constructor(private readonly setupService: SetupService) {}

	@Get()
	@OptionalAuth()
	@ApiOperation({ operationId: "getSetupStatus" })
	@ApiOkResponse({
		schema: {
			type: "object",
			properties: {
				needsSetup: { type: "boolean" },
			},
			required: ["needsSetup"],
		},
	})
	async getSetupStatus(): Promise<{ needsSetup: boolean }> {
		return { needsSetup: await this.setupService.needsSetup() };
	}
}
