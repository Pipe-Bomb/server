import { ApiProperty, ApiSchema, getSchemaPath } from "@nestjs/swagger";
import { AlbumResponse } from "src/albums/response/album.response";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import { PersistentAttributeResponse } from "src/attributes/response/persistent-attribute.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "src/tracks/response/track.response";

@ApiSchema({ name: "Artist" })
export class ArtistResponse {
	@ApiProperty({
		nullable: true,
		type: "string",
	})
	uuid: string | null;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes:
		| DBArtistAttribute[]
		| null
		| Record<string, PersistentAttributeResponse>;

	@ApiProperty({
		type: [IdentityResponse],
		nullable: true,
	})
	identities: IdentityResponse[] | null;

	@ApiProperty({
		type: () => [TrackResponse],
		nullable: true,
	})
	tracks: TrackResponse[] | null;

	@ApiProperty({
		type: () => [AlbumResponse],
		nullable: true,
	})
	albums: AlbumResponse[] | null;
}
