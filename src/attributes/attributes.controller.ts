import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { AllAttributesResponse } from "./response/all-attributes.response";
import { LoadedAttribute } from "./interface/loaded-attribute.interface";
import { LoadedAttributeResponse } from "./response/loaded-attribute.response";
import { Attribute } from "@sdk";
import { AttributeType } from "./enum/attribute-type.enum";
import {
	ApiBody,
	ApiConsumes,
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AttributeUploadService } from "./attribute-upload.service";
import { ReqUser } from "src/users/user.decorator";
import { FetchUserPipe } from "src/users/user.pipe";
import { DBUser } from "src/users/entity/user.entity";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("attributes")
export class AttributesController {
	constructor(
		private readonly attributesService: AttributesService,
		private readonly attributeUploadService: AttributeUploadService,
		private readonly attributeSourcesService: AttributeSourcesService,
	) {}

	@Get()
	@ApiOkResponse({
		type: AllAttributesResponse,
	})
	getAllAttributes(): AllAttributesResponse {
		const track = this.attributeSourcesService.getTrackAttributes();
		const artist = this.attributeSourcesService.getArtistAttributes();
		const album = this.attributeSourcesService.getAlbumAttributes();

		return {
			track: track.map(this.toResponse),
			artist: artist.map(this.toResponse),
			album: album.map(this.toResponse),
		};
	}

	@Put("buffer/:uuid")
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			properties: {
				file: {
					type: "string",
					format: "binary",
				},
			},
		},
	})
	@ApiNoContentResponse()
	@ApiForbiddenResponse()
	@ApiNotFoundResponse()
	@ApiUnauthorizedResponse()
	@UseInterceptors(FileInterceptor("file"))
	@HttpCode(HttpStatus.NO_CONTENT)
	async uploadAttributeBuffer(
		@Param("uuid") uuid: string,
		@UploadedFile() file: Express.Multer.File,
		@ReqUser(FetchUserPipe) user: DBUser,
	) {
		this.attributeUploadService.resolveSession(uuid, file.buffer, user);
	}

	toResponse(attribute: LoadedAttribute): LoadedAttributeResponse {
		const typeMap: Record<Attribute["type"], AttributeType> = {
			boolean: AttributeType.BOOLEAN,
			buffer: AttributeType.BUFFER,
			decimal: AttributeType.DECIMAL,
			integer: AttributeType.INTEGER,
			string: AttributeType.STRING,
		};

		return {
			pluginId: attribute.source?.plugin.package.name ?? "",
			sourceId: attribute.source?.source.id ?? "",
			key: attribute.attribute.key,
			type: typeMap[attribute.attribute.type],
			supportsMultiple: attribute.attribute.supportsMultiple,
		};
	}
}
