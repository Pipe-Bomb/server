import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { UserResponse } from "src/users/response/user.response";
import { PlaylistMemberRole } from "../enum/playlist-member-role.enum";

@ApiSchema({ name: "PlaylistMember" })
export class PlaylistMemberResponse {
	@ApiProperty()
	userUuid: string;

	@ApiProperty({
		type: () => UserResponse,
		nullable: true,
	})
	user: UserResponse | null;

	@ApiProperty({
		enum: PlaylistMemberRole,
		enumName: "PlaylistMemberRole",
	})
	role: PlaylistMemberRole;

	@ApiProperty({ type: Date })
	dateAdded: Date;
}
