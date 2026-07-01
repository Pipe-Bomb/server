import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import {
	PersistentBooleanAttributeResponse,
	PersistentBufferAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentStringAttributeResponse,
} from "src/attributes/response/persistent-attribute.response";
import { AttributeMapResponse } from "../../attributes/response/attribute-map.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackArtistResponse } from "./track-artist.response";
import { DBTrackAttribute } from "src/attributes/entities/track-attribute.entity";
import { AlbumResponse } from "src/albums/response/album.response";

@ApiSchema({ name: "Track" })
@ApiExtraModels(
	PersistentStringAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentBufferAttributeResponse,
)
export class TrackResponse {
	@ApiProperty({
		type: String,
	})
	trackId: string;

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
		type: Date,
	})
	dateAdded: Date;

	@ApiProperty({
		type: [TrackArtistResponse],
		nullable: true,
	})
	artists: TrackArtistResponse[] | null;

	@ApiProperty({
		type: [AlbumResponse],
		nullable: true,
	})
	albums: AlbumResponse[] | null;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: DBTrackAttribute[] | null;

	@ApiProperty({
		type: [IdentityResponse],
		nullable: true,
	})
	identities: IdentityResponse[] | null;
}
