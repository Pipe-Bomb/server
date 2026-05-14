import { ApiProperty, ApiSchema, getSchemaPath } from "@nestjs/swagger";
import { DBAlbumAttribute } from "src/attributes/entities/album-attribute.entity";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "src/tracks/response/track.response";
import { AlbumArtistResponse } from "./album-artist.response";

@ApiSchema({ name: "Album" })
export class AlbumResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: DBAlbumAttribute[] | null;

	@ApiProperty({
		type: () => [IdentityResponse],
		nullable: true,
	})
	identities: IdentityResponse[] | null;

	@ApiProperty({
		type: () => [TrackResponse],
		nullable: true,
	})
	tracks: TrackResponse[] | null;

	@ApiProperty({
		type: () => [AlbumArtistResponse],
		nullable: true,
	})
	artists: AlbumArtistResponse[] | null;
}
