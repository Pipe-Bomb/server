import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { EphemeralTrackResponse } from "./ephemeral-track.response";

@ApiSchema({ name: "EphemeralSearchResults" })
export class EphemeralSearchResultsResponse {
	@ApiProperty({
		type: [EphemeralTrackResponse],
	})
	tracks: EphemeralTrackResponse[];
}
