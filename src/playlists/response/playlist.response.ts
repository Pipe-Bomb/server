import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { DBPlaylistAttribute } from "src/attributes/entities/playlist-attribute.entity";
import { AttributeMapResponse } from "src/attributes/response/attribute-map.response";
import {
	PersistentStringAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentBufferAttributeResponse,
} from "src/attributes/response/persistent-attribute.response";
import { UserResponse } from "src/users/response/user.response";
import { PlaylistTrackResponse } from "./playlist-track.response";

@ApiSchema({ name: "Playlist" })
@ApiExtraModels(
	PersistentStringAttributeResponse,
	PersistentBooleanAttributeResponse,
	PersistentDecimalAttributeResponse,
	PersistentIntegerAttributeResponse,
	PersistentBufferAttributeResponse,
)
export class PlaylistResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	ownerUuid: string;

	@ApiProperty({
		type: () => UserResponse,
		nullable: true,
	})
	owner: UserResponse | null;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: DBPlaylistAttribute[] | null;

	@ApiProperty({
		type: [PlaylistTrackResponse],
		nullable: true,
	})
	tracks: PlaylistTrackResponse[] | null;

	@ApiProperty({
		type: "integer",
		nullable: true,
	})
	trackCount: number | null;
}
