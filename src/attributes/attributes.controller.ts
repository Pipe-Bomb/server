import { Controller, Get } from "@nestjs/common";
import { AttributesService } from "./attributes.service";
import { AttributeSourcesService } from "src/attribute-sources/attribute-sources.service";
import { AllAttributesResponse } from "./response/all-attributes.response";
import { LoadedAttribute } from "./interface/loaded-attribute.interface";
import { LoadedAttributeResponse } from "./response/loaded-attribute.response";
import { Attribute } from "@sdk";
import { AttributeType } from "./enum/attribute-type.enum";
import { ApiOkResponse } from "@nestjs/swagger";

@Controller("attributes")
export class AttributesController {
	constructor(
		private readonly attributesService: AttributesService,
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

	toResponse(attribute: LoadedAttribute): LoadedAttributeResponse {
		const typeMap: Record<Attribute["type"], AttributeType> = {
			boolean: AttributeType.BOOLEAN,
			buffer: AttributeType.BUFFER,
			decimal: AttributeType.DECIMAL,
			integer: AttributeType.INTEGER,
			string: AttributeType.STRING,
		};

		return {
			pluginId: attribute.source.plugin.package.name,
			sourceId: attribute.source.source.id,
			key: attribute.attribute.key,
			type: typeMap[attribute.attribute.type],
			supportsMultiple: attribute.attribute.supportsMultiple,
		};
	}
}
