import { ApiProperty, ApiSchema, getSchemaPath } from "@nestjs/swagger";
import { DBArtistAttribute } from "src/attributes/entities/artist-attribute.entity";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import { IdentityResponse } from "src/identifiers/response/identity.response";
import { TrackResponse } from "src/tracks/response/track.response";

@ApiSchema({ name: "Artist" })
export class ArtistResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: DBArtistAttribute[] | null;

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
}
