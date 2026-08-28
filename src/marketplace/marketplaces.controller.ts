import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
} from "@nestjs/common";
import { Post } from "@nestjs/common";
import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Privileges } from "src/privileges/privileges.decorator";
import { AddMarketplaceDto } from "./dto/add-marketplace.dto";
import { MarketplacesService } from "./marketplaces.service";
import { MarketplacePluginResponse } from "./response/marketplace-plugin.response";
import { MarketplaceResponse } from "./response/marketplace.response";
import { PrivilegesService } from "src/privileges/privileges.service";

@Controller("marketplaces")
export class MarketplacesController {
	constructor(
		private readonly marketplaceService: MarketplacesService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(
			null,
			"modify-plugin-marketplaces",
		);
		this.privilegesService.registerPrivilege(null, "view-plugin-marketplaces", [
			"modify-plugin-marketplaces",
		]);
	}

	@Get()
	@ApiOperation({ operationId: "listMarketplaces" })
	@ApiOkResponse({ type: [MarketplaceResponse] })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@Privileges("view-plugin-marketplaces")
	listMarketplaces(): Promise<MarketplaceResponse[]> {
		return this.marketplaceService.listMarketplaces();
	}

	@Post()
	@ApiOperation({ operationId: "addMarketplace" })
	@ApiCreatedResponse({ type: MarketplaceResponse })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.CREATED)
	@Privileges("modify-plugin-marketplaces")
	addMarketplace(@Body() dto: AddMarketplaceDto): Promise<MarketplaceResponse> {
		return this.marketplaceService.addMarketplace(dto.url);
	}

	@Delete(":uuid")
	@ApiOperation({ operationId: "removeMarketplace" })
	@ApiNoContentResponse()
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@HttpCode(HttpStatus.NO_CONTENT)
	@Privileges("modify-plugin-marketplaces")
	async removeMarketplace(@Param("uuid") uuid: string): Promise<void> {
		return this.marketplaceService.removeMarketplace(uuid);
	}

	@Get("plugins")
	@ApiOperation({ operationId: "listMarketplacePlugins" })
	@ApiOkResponse({ type: [MarketplacePluginResponse] })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@Privileges("view-plugin-marketplaces")
	listPlugins(): Promise<MarketplacePluginResponse[]> {
		return this.marketplaceService.listPlugins();
	}
}
