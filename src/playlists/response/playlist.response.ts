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
import { SmartPlaylistFilterGroupResponse } from "./smart-playlist-filter-group.reponse";

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
		type: Date,
	})
	dateCreated: Date;

	@ApiProperty({
		type: Date,
	})
	dateModified: Date;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath(AttributeMapResponse) }],
		nullable: true,
	})
	attributes: DBPlaylistAttribute[] | null;

	@ApiProperty({
		type: [SmartPlaylistFilterGroupResponse],
		nullable: true,
	})
	filterGroups: SmartPlaylistFilterGroupResponse[] | null;

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
