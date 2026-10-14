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
import { PlaylistTrackResponse } from "./playlist-track.response";
import { PlaylistMemberResponse } from "./playlist-member.response";
import { SmartPlaylistFilterGroupResponse } from "./smart-playlist-filter-group.reponse";
import { PlaylistVisibility } from "../enum/playlist-visibility.enum";
import {
	PlaylistBotCreatorResponse,
	PlaylistSystemCreatorResponse,
	PlaylistUserCreatorResponse,
} from "./playlist-creator.response";
import type { PlaylistCreatorResponse } from "./playlist-creator.response";
import { PlaylistCreatorTypeEnum } from "../enum/playlist-creator-type.enum";

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

	@ApiProperty({
		oneOf: [
			{ $ref: getSchemaPath(PlaylistUserCreatorResponse) },
			{ $ref: getSchemaPath(PlaylistBotCreatorResponse) },
			{ $ref: getSchemaPath(PlaylistSystemCreatorResponse) },
		],
		discriminator: {
			propertyName: "type",
			mapping: {
				[PlaylistCreatorTypeEnum.USER]: getSchemaPath(
					PlaylistUserCreatorResponse,
				),
				[PlaylistCreatorTypeEnum.BOT]: getSchemaPath(
					PlaylistBotCreatorResponse,
				),
				[PlaylistCreatorTypeEnum.SYSTEM]: getSchemaPath(
					PlaylistSystemCreatorResponse,
				),
			},
		},
	})
	owner: PlaylistCreatorResponse;

	@ApiProperty({
		type: Date,
	})
	dateCreated: Date;

	@ApiProperty({
		type: Date,
	})
	dateModified: Date;

	@ApiProperty({
		enum: PlaylistVisibility,
		enumName: "PlaylistVisibility",
	})
	visibility: PlaylistVisibility;

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

	@ApiProperty({
		type: [PlaylistMemberResponse],
		nullable: true,
	})
	members: PlaylistMemberResponse[] | null;
}
