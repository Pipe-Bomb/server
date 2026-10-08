import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { TrackResponse } from "./track.response";

@ApiSchema({ name: "SavedTracks" })
export class SavedTracksResponse {
	@ApiProperty({
		type: [TrackResponse],
	})
	tracks: TrackResponse[];

	@ApiProperty({ type: Number })
	total: number;
}
