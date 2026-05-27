import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TrackResponse } from "src/tracks/response/track.response";

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
}
