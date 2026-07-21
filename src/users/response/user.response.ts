import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { PlaylistResponse } from "src/playlists/response/playlist.response";
import { PrivilegeResponse } from "src/privileges/response/privilege.response";

@ApiSchema({ name: "User" })
export class UserResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	username: string;

	@ApiProperty({
		type: () => [PlaylistResponse],
		nullable: true,
	})
	playlists: PlaylistResponse[] | null;

	@ApiProperty({
		type: [PrivilegeResponse],
		nullable: true,
	})
	privileges: PrivilegeResponse[] | null;
}
