import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
} from "@nestjs/common";
import { IdentifiersService } from "./identifiers.service";
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { IdentifierResponse } from "./response/identifier.response";
import { PrivilegesService } from "src/privileges/privileges.service";
import { Privileges } from "src/privileges/privileges.decorator";
import { UpdateIdentifiersDto } from "./dto/update-identifiers.dto";
import { DisabledIdentifiersService } from "./disabled-identifiers.service";
import { IdentifierType } from "./enum/identifier-type.enum";

@Controller("identifiers")
export class IdentifiersController {
	constructor(
		private readonly identifiersService: IdentifiersService,
		private readonly disabledIdentifiersService: DisabledIdentifiersService,
		private readonly privilegesService: PrivilegesService,
	) {
		this.privilegesService.registerPrivilege(null, "manage-identifiers");
	}

	@Get()
	@ApiOperation({ operationId: "getAllIdentifiers" })
	@ApiOkResponse({
		type: [IdentifierResponse],
	})
	async getAll(): Promise<IdentifierResponse[]> {
		const disabledSet = await this.disabledIdentifiersService.getDisabledSet();

		const track = this.identifiersService.all().map((entry) => {
			const key = `${entry.plugin.package.name}:${entry.identifier.id}:track`;
			return this.identifiersService.toResponse(
				entry,
				IdentifierType.Track,
				disabledSet.has(key),
			);
		});

		const artist = this.identifiersService.allArtist().map((entry) => {
			const key = `${entry.plugin.package.name}:${entry.identifier.id}:artist`;
			return this.identifiersService.toResponse(
				entry,
				IdentifierType.Artist,
				disabledSet.has(key),
			);
		});

		const album = this.identifiersService.allAlbum().map((entry) => {
			const key = `${entry.plugin.package.name}:${entry.identifier.id}:album`;
			return this.identifiersService.toResponse(
				entry,
				IdentifierType.Album,
				disabledSet.has(key),
			);
		});

		return [...track, ...artist, ...album];
	}

	@Post()
	@Privileges("manage-identifiers")
	@ApiOperation({ operationId: "updateIdentifiers" })
	@ApiUnauthorizedResponse()
	@ApiForbiddenResponse()
	@ApiBadRequestResponse()
	@ApiOkResponse({
		type: [IdentifierResponse],
	})
	@HttpCode(HttpStatus.OK)
	async updateIdentifiers(
		@Body() dto: UpdateIdentifiersDto,
	): Promise<IdentifierResponse[]> {
		const registeredKeys = new Set([
			...this.identifiersService
				.all()
				.map((e) => `${e.plugin.package.name}:${e.identifier.id}:track`),
			...this.identifiersService
				.allArtist()
				.map((e) => `${e.plugin.package.name}:${e.identifier.id}:artist`),
			...this.identifiersService
				.allAlbum()
				.map((e) => `${e.plugin.package.name}:${e.identifier.id}:album`),
		]);

		const allItems = [...dto.enable, ...dto.disable];
		const unknown = allItems.filter(
			(item) =>
				!registeredKeys.has(
					`${item.pluginId}:${item.identifierId}:${item.type}`,
				),
		);
		if (unknown.length) {
			throw new BadRequestException(
				`Unknown identifiers: ${unknown.map((i) => `${i.pluginId}:${i.identifierId}:${i.type}`).join(", ")}`,
			);
		}

		await this.disabledIdentifiersService.disableIdentifiers(dto.disable);
		await this.disabledIdentifiersService.enableIdentifiers(dto.enable);
		return this.getAll();
	}
}
