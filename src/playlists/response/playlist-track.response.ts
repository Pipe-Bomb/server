import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TrackResponse } from "src/tracks/response/track.response";
import { UserResponse } from "src/users/response/user.response";

@ApiSchema({ name: "PlaylistTrack" })
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
		type: "boolean",
	})
	addedBySystem: boolean;

	@ApiProperty({
		type: () => UserResponse,
		nullable: true,
	})
	addedBy: UserResponse | null;
}
