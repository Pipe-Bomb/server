import { ApiProperty, ApiSchema, getSchemaPath } from "@nestjs/swagger";
import type { UserResponse } from "src/users/response/user.response";
import { PlaylistCreatorTypeEnum } from "../enum/playlist-creator-type.enum";

export abstract class BasePlaylistCreatorResponse {
	@ApiProperty({ enum: PlaylistCreatorTypeEnum })
	type: PlaylistCreatorTypeEnum;
}

@ApiSchema({ name: "PlaylistUserCreator" })
export class PlaylistUserCreatorResponse extends BasePlaylistCreatorResponse {
	@ApiProperty({ enum: [PlaylistCreatorTypeEnum.USER] })
	override type: PlaylistCreatorTypeEnum.USER = PlaylistCreatorTypeEnum.USER;

	@ApiProperty({
		type: String,
	})
	userUuid: string;

	@ApiProperty({
		oneOf: [{ $ref: getSchemaPath("User") }],
		nullable: true,
	})
	user: UserResponse | null;
}

@ApiSchema({ name: "PlaylistBotCreator" })
export class PlaylistBotCreatorResponse extends BasePlaylistCreatorResponse {
	@ApiProperty({ enum: [PlaylistCreatorTypeEnum.BOT] })
	override type: PlaylistCreatorTypeEnum.BOT = PlaylistCreatorTypeEnum.BOT;

	@ApiProperty({
		type: String,
	})
	pluginId: string;

	@ApiProperty({
		type: String,
	})
	botId: string;

	@ApiProperty({
		type: String,
		nullable: true,
	})
	botName: string | null;
}

@ApiSchema({ name: "PlaylistSystemCreator" })
export class PlaylistSystemCreatorResponse extends BasePlaylistCreatorResponse {
	@ApiProperty({ enum: [PlaylistCreatorTypeEnum.SYSTEM] })
	override type: PlaylistCreatorTypeEnum.SYSTEM =
		PlaylistCreatorTypeEnum.SYSTEM;
}

export type PlaylistCreatorResponse =
	| PlaylistUserCreatorResponse
	| PlaylistBotCreatorResponse
	| PlaylistSystemCreatorResponse;
