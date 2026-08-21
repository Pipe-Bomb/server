import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { PlaylistMemberRole } from "../enum/playlist-member-role.enum";

export class UpsertPlaylistMemberDto {
	@ApiProperty({
		enum: PlaylistMemberRole,
		enumName: "PlaylistMemberRole",
	})
	@IsEnum(PlaylistMemberRole)
	role: PlaylistMemberRole;
}
