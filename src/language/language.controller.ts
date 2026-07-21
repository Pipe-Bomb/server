import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { LanguageService } from "./language.service";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { LanguageMapResponse } from "./response/language-map.response";
import { OptionalAuth } from "src/user-manager/optional-auth.decorator";

@Controller("language")
export class LanguageController {
	constructor(private readonly languageService: LanguageService) {}

	@Get()
	@ApiOperation({ operationId: "getLanguageIds" })
	@ApiOkResponse({
		type: [String],
	})
	getLanguages() {
		return this.languageService.getIds();
	}

	@Get(":languageId")
	@ApiOperation({ operationId: "getLanguageMap" })
	@ApiOkResponse({
		type: LanguageMapResponse,
	})
	@OptionalAuth() // todo: hide plugin keys from unauthorised clients
	getMap(@Param("languageId") languageId: string): LanguageMapResponse {
		const map = this.languageService.getMap(languageId);
		if (map) {
			return {
				id: languageId,
				keys: map,
			};
		}

		throw new NotFoundException("Language map not found");
	}
}
