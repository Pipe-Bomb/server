import { ApiProperty } from "@nestjs/swagger";
import { TrackResponse } from "src/tracks/response/track.response";

export class LibraryFindResponse {
	@ApiProperty({
		type: [TrackResponse],
	})
	tracks: TrackResponse[];
}
