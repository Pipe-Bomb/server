import {
	ApiExtraModels,
	ApiProperty,
	ApiSchema,
	getSchemaPath,
} from "@nestjs/swagger";
import { TrackResponse } from "src/tracks/response/track.response";
import {
	PlaylistBotCreatorResponse,
	PlaylistSystemCreatorResponse,
	PlaylistUserCreatorResponse,
} from "./playlist-creator.response";
import type { PlaylistCreatorResponse } from "./playlist-creator.response";
import { PlaylistCreatorTypeEnum } from "../enum/playlist-creator-type.enum";

@ApiSchema({ name: "PlaylistTrack" })
@ApiExtraModels(
	PlaylistUserCreatorResponse,
	PlaylistBotCreatorResponse,
	PlaylistSystemCreatorResponse,
)
export class PlaylistTrackResponse {
	@ApiProperty({
		type: TrackResponse,
	})
	track: TrackResponse;

	@ApiProperty({
		type: Date,
	})
	dateAdded: Date;

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
	addedBy: PlaylistCreatorResponse;
}
