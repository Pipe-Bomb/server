import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import {
	PersistentStringAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentAttributeResponse,
} from "src/attributes/response/persistent-attribute.response";
import { TrackArtistResponse } from "src/tracks/response/track-artist.response";

@ApiSchema({ name: "EphemeralTrack" })
@ApiExtraModels(
	PersistentStringAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentBufferAttributeResponse,
)
export class EphemeralTrackResponse {
	@ApiProperty({
		type: String,
	})
	id: string;

	@ApiProperty({
		type: String,
	})
	pluginId: string;

	@ApiProperty({
		type: String,
	})
	libraryId: string;

	@ApiProperty({
		type: String,
	})
	title: string;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: Record<string, PersistentAttributeResponse> | null;

	@ApiProperty({
		type: [TrackArtistResponse],
		nullable: true,
	})
	artists: TrackArtistResponse[] | null;
}
